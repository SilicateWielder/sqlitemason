/* Wrapper for SQLite intended to remove the need for directly embedding SQL into code.
Written by Michael Warner. 2021
*/

"use strict";

const sqlite = require('sqlite3');


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Type definitions. Used to compare and reject invalid data on new record insertions or updates.
// Additionally, used for formatting SQL Queries.
const DataTypes = {
	'INT': Number.prototype,
	'INTEGER': Number.prototype,
	'TINYINT': Number.prototype,
	'SMALLINT': Number.prototype,
	'MEDIUMINT': Number.prototype,
	'BIGINT': Number.prototype,
	'UNISIGNED BIG INT': Number.prototype,
	'INT2': Number.prototype,
	'INT8': Number.prototype,
	
	'CHARACTER': String.prototype,
	'VARCHAR': String.prototype,
	'VARYING CHARACTER': String.prototype,
	'NCHAR': String.prototype,
	'NATIVE CHARACTER': String.prototype,
	'NVARCHAR': String.prototype,
	'TEXT': String.prototype,
	'CLOB': String.prototype,
	'BLOB': String.prototype,
	'BLOB': String.prototype,
	
	'REAL': Number.prototype,
	'DOUBLE': Number.prototype,
	'DOUBLE PRECISION': Number.prototype,
	'FLOAT': Number.prototype,
	
	'NUMERIC': Number.prototype,
	'DECIMAL': Number.prototype,
	'BOOLEAN': Boolean.prototype,
	'DATE': String.prototype,
	'DATETIME': String.prototype,
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
class SQLiteMason
{
	constructor (path) {
		this.db = new sqlite.Database(path);
		this.cache = {};
		this.cache.tables = {};
		this.cache.edited = false;
		
		//////////////////////////////
		////////////////////////////////////////////////////////////
		this.defaultRowFlags = {
			'type': 'BIGINT',
			'primary': false,
			'notNull': false,
			'unique': false,
			'conflictResponse': 'ABORT',
			'defaultVal': ''
		}
		Object.freeze(this.defaultRowFlags);
		////////////////////////////////////////////////////////////
		//////////////////////////////
		
		this.defaultRowFlagsKeys = Object.keys(this.defaultRowFlags);
		Object.freeze(this.defaultRowFlagsKeys); // Because I'm a paranoid bastard.
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	runSQL(query) {
		return this.db.run(query);
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	getSQL(query) {
		return this.db.get(query);
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	getTableFieldSQL(tableName, array) {
		if (this.cache.tables[tableName] == undefined && array == undefined) return '';
		const table = (array == undefined) ? this.cache.tables[tableName] : array; // Use provided array instead of stored, if available.
		
		const prefix = 'CREATE TABLE IF NOT EXISTS [' + tableName + '] (\n';
		const suffix = ');';
	
		let middle = ''
		
		let fieldNames = this.cache.tables[tableName].keys;
		
		for(let i = 0; i < fieldNames.length; i++)
		{
			const fieldName = fieldNames[i]
			const row = table.fields[fieldName];
			
			let newSql = '    [' + fieldName + '] ' + row.type;
			
			if(row.primary) newSql += ' PRIMARY KEY ON CONFLICT ABORT'; // Begin adding flags.
			if(row.notNull) newSql += ' NOT NULL';
			if(row.unique) newSql += ' UNIQUE';
			if(row.defaultVal != '' && row.unique == false) newSql += ` DEFAULT ${row.defaultVal}`; 
			
			// Appends comma if we have another row and always a newline escape sequence.
			middle += newSql + ((i < fieldNames.length - 1) ? ',\n' : ''); // Sometimes you write something and it seems like a great idea,
			                                                              // until you look back on it and go, "Dear lord." and die a little inside.
		}
		
		return prefix + middle + suffix;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	// WIP definitely will not work for all data, just as a heads up.
	
	getTableRecordSQL(tableName, array) {
		if(this.cache.tables[tableName] == undefined) return '';
		
		////////////////////////////////////////////////////////////
		
		const tableFields = this.cache.tables[tableName].keys;
		const tableFieldData = this.cache.tables[tableName].fields;
		const tableRecords = (array == undefined) ? this.cache.tables[tableName].records : array;
		
		////////////////////////////////////////////////////////////
		
		if(tableRecords == []) return ''; // If there are no records we can't do anything.
		
		////////////////////////////////////////////////////////////
		
		const fieldString = tableFields.join(', ');
		const prefix = 'INSERT OR REPLACE INTO ' + tableName + ' (' + fieldString + ') VALUES\n';
		const suffix = ';';
		
		let middle = '';
		
		////////////////////////////////////////////////////////////
		
		for(let i = 0; i < tableRecords.length; i++)
		{
			const currentRecord = tableRecords[i]
			let end = (i < tableRecords.length - 1) ? '),\n' : ')';
			
			let elements = '(';
			
			/////////////////////////////////////////////////
			
			for(let e = 0; e < tableFields.length; e++)
			{
				elements += currentRecord[tableFields[e]];
				
				if (e < tableFields.length - 1) elements += ',';
			}
			
			/////////////////////////////////////////////////
			
			middle += elements + end + '';
		}
		
		////////////////////////////////////////////////////////////
		
		return prefix + middle + suffix;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	addTable(tableName)
	{
		if(this.cache.tables[tableName] != undefined) return false;
		
		//////////////////////////////
		
		this.cache.tables[tableName] = {};
		this.cache.tables[tableName].fields = {};
		this.cache.tables[tableName].keys = [];
		this.cache.tables[tableName].records = [];
		
		//////////////////////////////
		
		return true;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	commitTable(tableName, array) {
		if(array != undefined) this.cache.tables[tableName] = array;
		this.runSQL(this.getTableFieldSQL(tableName));
		
		return true;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	commitTableRecords(tableName, array) {
		
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	addTableField(tableName, data) {
		if(this.cache.tables[tableName] == undefined) return false; // Make sure the tablename is specified
		if(data.name == undefined) return false; // Make sure a field name is specified.
		
		const fieldName = data.name;
		let table = this.cache.tables[tableName];
		
		if(table.fields[fieldName] != undefined) return false; //Make sure our field doesn't exist.
		
		//////////////////////////////
		
		let newRow = {};
		
		// Populate new table flags.
		for(let i = 0; i < this.defaultRowFlagsKeys.length; i++)
		{
			let key = this.defaultRowFlagsKeys[i];
			
			if(data[key] != undefined) {
				
				newRow[key] = data[key];
				
			} else {
				newRow[key] = this.defaultRowFlags[key];
			}
		}
		
		// push the table to our cache.
		table.fields[fieldName] = newRow;
		table.keys = Object.keys(this.cache.tables[tableName].fields);
		
		//////////////////////////////
		
		return true;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	addRecord(tableName, data) {
		if(this.cache.tables[tableName] == undefined) return false; // Ensure table exists.
		
		if(this.cache.tables[tableName].keys != Object.keys(data)) { // Ensure new record matches field keys.
		
			this.cache.tables[tableName].records.push(data);
			
		} else {
			throw 'Record Definition Error: Field mismatch.';
		}
		
		return true;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	getTableJSON(tableName) {
		return JSON.stringify(this.cache.tables[tableName]);
		
	}
	
	
}

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

const colors = require('colors');

let testdb = new SQLiteMason('./test.sqlite');

let testResults = {};

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

function checkTestResults (testResults) {
	
	let keys = Object.keys(testResults);
	
	for(let i = 0; i < keys.length; i++)
	{
		let name = keys[i].match(/[A-Z][a-z]+|[0-9]+/g).join(' ');
		
		console.log(colors.yellow('Test ') + name + ': ' + ((testResults[keys[i]]) ? colors.green('PASS'): colors.red('FAIL')));
	}
}

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

console.log('Beginning Self-test, false positives may be abound...');

testResults.CreateTable1 = testdb.addTable('users');
testResults.CreateField1 = testdb.addTableField('users', { name: 'internal_id', type: 'BIGINT', unique: true, primary: true, notNull: true });
testResults.CreateField2 = testdb.addTableField('users', { name: 'discord_id', type: 'BLOB_TEXT', unique: true, notNull: true });
testResults.CreateField3 = testdb.addTableField('users', { name: 'sys_admin', type: 'BOOLEAN', notNull: true, defaultVal: '0'});
testResults.AddRecord1 = testdb.addRecord('users', { 'internal_id': '12312', 'discord_id': '43242341235452354', 'sys_admin': false});
testResults.AddRecord2 = testdb.addRecord('users', { 'internal_id': '12313', 'discord_id': '00002341235452354', 'sys_admin': false});

testResults.CommitTable1 = testdb.commitTable('users');

console.log(testdb.getTableRecordSQL('users'));

checkTestResults(testResults);
