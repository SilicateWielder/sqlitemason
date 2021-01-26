/* Wrapper for SQLite intended to remove the need for directly embedding SQL into code.
Written by Michael Warner. 2021
*/

"use strict";


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
	constructor () {
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
	
	////////////////////////////////////////////////////////////
	
	addRecord(tableName, data) {
		if(this.cache.tables[tableName] == undefined) return false; // Ensure table exists.
		
		if(this.cache.tables[tableName].keys != Object.keys(data)) { // Ensure new record matches field keys.
		
			this.cache.tables[tableName].records.push(data);
			
		} else {
			throw 'Record Definition Error: Field mismatch.';
		}
		
		return true;
	}
	
	////////////////////////////////////////////////////////////
	
	getTableJSON(tableName) {
		return JSON.stringify(this.cache.tables[tableName]);
	}
	
	////////////////////////////////////////////////////////////
	
	getTableFieldSQL(tableName) {
		if (this.cache.tables[tableName] == undefined) return '';
		const table = this.cache.tables[tableName];
		
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
}

let testdb = new SQLiteMason();

console.log(testdb.addTable('users'));
console.log(testdb.addTableField('users', { name: 'internal_id', type: 'BIGINT', unique: true, primary: true, notNull: true }));
console.log(testdb.addTableField('users', { name: 'discord_id', type: 'BLOB_TEXT', unique: true, notNull: true }));
console.log(testdb.addTableField('users', { name: 'sys_admin', type: 'BOOLEAN', notNull: true, defaultVal: '0'}));
console.log(testdb.addRecord('users', { 'internal_id': '0', 'discord_id': '0', 'sys_admin': false}));

console.log(testdb.getTableFieldSQL('users'));
