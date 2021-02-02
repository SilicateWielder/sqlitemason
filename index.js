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
	'INT': 'number',
	'INTEGER': 'number',
	'TINYINT': 'number',
	'SMALLINT': 'number',
	'MEDIUMINT': 'number',
	'BIGINT': 'number',
	'UNISIGNED BIG INT': 'number',
	'INT2': 'number',
	'INT8': 'number',
	
	'CHARACTER': 'string',
	'VARCHAR': 'string',
	'VARYING CHARACTER': 'string',
	'NCHAR': 'string',
	'NATIVE CHARACTER': 'string',
	'NVARCHAR': 'string',
	'TEXT': 'string',
	'CLOB': 'string',
	
	'BLOB': 'string',
	
	'REAL': 'number',
	'DOUBLE': 'number',
	'DOUBLE PRECISION': 'number',
	'FLOAT': 'number',
	
	'NUMERIC': 'number',
	'DECIMAL': 'number',
	'BOOLEAN': 'boolean',
	'DATE': 'string',
	'DATETIME': 'string',
};

// Used for verifying operators are valid.
const Operators = {
	'!=' : true,
	'=' : true,
	'>' : true,
	'>=' : true,
	'<' : true,
	'<=' : true
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
			'pk': false,
			'notnull': false,
			'unique': false,
			'conflictResponse': 'ABORT',
			'dflt_value': ''
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
	
	getDataSQL(query, params) {
		return new Promise((resolve, reject) => {
			this.db.get(query, params, (err, result) => {
				if (err) reject(err);
				
				resolve(result);
			})
		})
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	allDataSQL(query, params) {
		return new Promise((resolve, reject) => {
			this.db.all(query, params, (err, result) => {
				if (err) reject(err);
				
				resolve(result);
			})
		})
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
			
			if(row.pk) newSql += ' PRIMARY KEY ON CONFLICT ABORT'; // Begin adding flags.
			if(row.notnull) newSql += ' NOT NULL';
			if(row.unique) newSql += ' UNIQUE';
			if(row.dflt_value != '' && row.unique == false) newSql += ` DEFAULT ${row.dflt_value}`; 
			
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
		if(this.cache.tables[tableName].records == {}) return '';
		
		////////////////////////////////////////////////////////////
		
		const tableFields = this.cache.tables[tableName].keys;
		const tableFieldData = this.cache.tables[tableName].fields;
		const tableRecords = (array == undefined) ? this.cache.tables[tableName].records : array;
		
		////////////////////////////////////////////////////////////
		
		if(tableRecords == [] || tableRecords.length == 0) return ''; // If there are no records we can't do anything.
		
		////////////////////////////////////////////////////////////
		
		const fieldString = tableFields.join(', ');
		const prefix = 'INSERT OR REPLACE INTO ' + tableName + ' (' + fieldString + ') VALUES\n';
		const suffix = ';';
		
		let middle = '';
		
		////////////////////////////////////////////////////////////
		
		for(let i = 0; i < tableRecords.length; i++)
		{
			const currentRecord = tableRecords[i];
			let end = (i < tableRecords.length - 1) ? '),\n' : ')';
			
			let elements = '(';
			
			/////////////////////////////////////////////////
			
			for(let e = 0; e < tableFields.length; e++)
			{
				let fieldName = tableFields[e];
				let fieldType = tableFieldData[fieldName].type;
				
				let isString = (DataTypes[fieldType] == 'string');
				
				elements += (isString) ? ("'" + currentRecord[tableFields[e]] + "'") : (currentRecord[tableFields[e]]);
				
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
		if(array != undefined) this.cache.tables[tableName].records = array;
		
		const query = this.getTableRecordSQL(tableName);
		
		if (query != '') this.runSQL(query);
		
		return true;
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
				
				if(key == 'type' && DataTypes[data[key]] == undefined)
				{
					throw ('Invalid datatype: ' + data[key]);
				}
				
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
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	wipeCache() {
		this.cache = {
			tables: {},
			edited: false
		};
		
		if({tables: {}, edited: false} == this.cache) {
			return true;
		} else {
			false
		}
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////
	
	// Reads database into Cache.
	async syncCacheAll() {
		this.wipeCache();
		const tableNames = await this.allDataSQL("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
		
		////////////////////////////////////////////////////////////
		
		for(let t = 0; t < tableNames.length; t++)
		{	
			const currentTable = tableNames[t].name;
			this.cache.tables[currentTable] = {
				fields: {},
				keys: [],
				records: []
			};
			
			//////////////////////////////			
			const fieldDataRaw = await this.allDataSQL(`PRAGMA table_info(${currentTable});`);
			const tableData = await this.allDataSQL(`SELECT * FROM ${currentTable}`);
			
			this.cache.tables[currentTable].fields = {};
			
			for(let fieldId = 0; fieldId < fieldDataRaw.length; fieldId++)
			{
				// Find the current field's name and generate an entry on the cache.
				const fieldName = fieldDataRaw[fieldId].name;
				this.cache.tables[currentTable].fields[fieldName] = {};				
				this.cache.tables[currentTable].fields[fieldName] = fieldDataRaw[fieldId];
			}
			
			this.cache.tables[currentTable].records = tableData;
		}
		
		////////////////////////////////////////////////////////////
		
		return this.cache.tables;
	}
	
	selectData(tableName, values, arguments) {
		const table = this.cache.tables[tableName];
		
		
		let valueString = values.join(', ');
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

/*
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

Self-test section

console.log('Beginning Self-test, false positives may be abound...');

testResults.CreateTable1 = testdb.addTable('users');
testResults.CreateField1 = testdb.addTableField('users', { name: 'user_id', type: 'BIGINT', unique: true, pk: true, notnull: true });
testResults.CreateField2 = testdb.addTableField('users', { name: 'discord_id', type: 'TEXT', unique: true, notnull: true });
testResults.CreateField3 = testdb.addTableField('users', { name: 'sys_admin', type: 'BOOLEAN', notnull: true, dflt_value: '0'});
testResults.AddRecord1 = testdb.addRecord('users', { 'user_id': '12312', 'discord_id': '43242341235452354', 'sys_admin': false});
testResults.AddRecord2 = testdb.addRecord('users', { 'user_id': '12313', 'discord_id': '00002341235452354', 'sys_admin': false});
testResults.CommitTable1 = testdb.commitTable('users');
testResults.CommitRecords1 = testdb.commitTableRecords('users');

testResults.CreateTable2 = testdb.addTable('servers');
testResults.CreateField4 = testdb.addTableField('servers', { name: 'server_id', type: 'TEXT', unique: true, pk: true, notnull: true });
testResults.CreateField5 = testdb.addTableField('servers', { name: 'premium_server', type: 'BOOLEAN', notnull: true, dflt_value: false });
testResults.CommitTable2 = testdb.commitTable('servers');
testResults.commitTableRecords2 = testdb.commitTableRecords('servers');

testResults.CreateTable3 = testdb.addTable('users_experience');
testResults.CreateField5 = testdb.addTableField('users_experience', { name: 'user_id', type: 'BIGINT', unique: true, pk: true, notnull: true });
testResults.CreateField5 = testdb.addTableField('users_experience', { name: 'user_experience', type: 'BIGINT', notnull: true, dflt_value: 0 });
testResults.CommitTable3 = testdb.commitTable('users_experience');
testResults.CommitTableRecords3 = testdb.commitTableRecords('users_experience');

checkTestResults(testResults);

async function test () {	
	testdb.wipeCache();
	console.log("Data:" + JSON.stringify(await testdb.syncCacheAll()));
};

test();*/
