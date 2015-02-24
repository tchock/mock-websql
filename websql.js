// The data of the websql databases will be stored here!
var mockSQLStorage = {};
var mockSQLStorageDef = {};

// openDatabase mock
function mockOpenDatabase (name, version, displayName, estimatedSize, callback) {
  return new MockSQLDatabase(name, version, displayName, estimatedSize, callback);
}


// database object mock
var MockSQLDatabase = function (name, version, displayName, estimatedSize, createCallback) {
  this._name = name;
  this._version = version;
  this._displayName = displayName;
  this._estimatedSize = estimatedSize;

  // Create database storage object if it doesn't exist
  if (mockSQLStorage[name] === undefined || mockSQLStorageDef[name] === undefined) {
    mockSQLStorage[name] = {};
    mockSQLStorageDef[name] = {};
  }

  createCallback(this);
};

MockSQLDatabase.prototype.transaction = function (
    callback, errorCallback, successCallback) {
  var newTransaction = new MockSQLTransaction(this);
  callback(newTransaction);
  if (successCallback !== undefined) {
    successCallback(newTransaction);
  }
  // TODO Error case
};

MockSQLDatabase.prototype.changeVersion = function (
    oldVersion, newVersion, callback, errorCallback, successCallback) {
  // TODO implement change version
};


// transaction object mock
var MockSQLTransaction = function (db) {
  this.db = db;
};

MockSQLTransaction.prototype.executeSql = function (
    sqlStatement, args, callback, errorCallback) {
  var i, j;
  var statementParts, tableName;
  var tableDef, tableData;
  var field;
  var whereLeft, whereRight, rowsAffected;
  // TODO build statement with args

  // CREATE
  if (sqlStatement.substring(0, 12) === 'CREATE TABLE') {
    statementParts = sqlStatement.match(/CREATE TABLE (.*?) \((.*)\)/);
    tableName = statementParts[1];
    var tableRowString = statementParts[2];
    var tableRows = tableRowString.match(/([^\\\][^,]|\\,)+/g);

    for (i = 0; i < tableRows.length; i++) {
      var rowParts = tableRows[i].match(/([\w_-]+?)\s([\w\s]*)/);
      tableRows[i] = { name: rowParts[1] };
      var rowOptions = rowParts[2].match(/([^\\\][^\s]|\\\s)+/g);
      for (j = 0; j < rowOptions.length; j++) {
        switch(rowOptions[j]) {
          case 'INTEGER':
          case 'UINT':
            tableRows[i].type = 'INT';
            tableRows[i].size = 255;
            break;
          case 'VARCHAR':
            tableRows[i].type = 'VARCHAR';
            tableRows[i].size = 255;
            break;
          case 'TEXT':
            tableRows[i].type = 'TEXT';
            tableRows[i].size = -1;
            break;
          case 'PRIMARY':
            tableRows[i].primary = true;
            break;
          case 'KEY':
            tableRows[i].key = true;
            break;
          case 'AUTOINCREMENT':
            tableRows[i].autoIncrement = true;
            tableRows[i].autoIncrementValue = 1;
            break;
          case 'UNIQUE':
            tableRows[i].unique = true;
            break;
          case 'NOT':
            tableRows[i].not = true;
            break;
          case 'NULL':
            tableRows[i].null = true;
            break;
        }
      }
    }
    mockSQLStorageDef[this.db._name][tableName] = tableRows;
    mockSQLStorage[this.db._name][tableName] = [];

    callback(this, null);
    return;
  }

  // DROP TABLE
  else if (sqlStatement.substring(0, 20) === 'DROP TABLE IF EXISTS') {
    statementParts = sqlStatement.match(/DROP TABLE IF EXISTS [\"\`]{0,1}([\w_-]+?)[\"\`]{0,1}$/);
    tableName = statementParts[1];
    delete mockSQLStorage[this.db._name][tableName];
    delete mockSQLStorageDef[this.db._name][tableName];
    callback(this, new MockSQLResultSet([]));
    return;
  }

  // INSERT INTO
  else if (sqlStatement.substring(0, 11) === 'INSERT INTO') {
    statementParts = sqlStatement.match(/INSERT INTO (.*?) \((.*?)\) values \((.*?)\)$/);
    tableName = statementParts[1];
    var keys = statementParts[2];
    var values = statementParts[3];
    var insertId;
    tableDef = mockSQLStorageDef[this.db._name][tableName];

    // table keys
    keys = keys.split(', ');
    values = values.replace(/\'/g, '');
    values = values.split(', ');

    var newEntry = {};
    for (i = 0; i < tableDef.length; i++) {
      var fieldDefined = false;
      for (j = 0; j < keys.length; j++) {
        if (keys[j] === tableDef[i].name) {
          newEntry[keys[j]] = values[j];
          fieldDefined = true;
          break;
        }
      }

      if (!fieldDefined && tableDef[i].autoIncrement) {
        newEntry[tableDef[i].name] = tableDef[i].autoIncrementValue++;
        if (tableDef[i].primary) {
          insertId = newEntry[i];
        }
      } else if (!fieldDefined) {
        newEntry[i] = null;
      }
    }

    mockSQLStorage[this.db._name][tableName].push(newEntry);

    callback(this, new MockSQLResultSet(newEntry, 1, insertId));
    return;
  }

  // UPDATE
  else if (sqlStatement.substring(0, 6) === 'UPDATE') {
    statementParts = sqlStatement.match(/UPDATE\s([\w-_]+?)\s+SET\s+(.*?)\s+WHERE\s+([\w-_]+?)\s*=\s*(.*?)$/);
    tableName = statementParts[1];
    var setFields = statementParts[2];
    whereLeft = statementParts[3];
    whereRight = statementParts[4];
    if (!isNaN(whereRight)) {
      whereRight = parseInt(whereRight);
    }
    rowsAffected = 0;
    tableData = mockSQLStorage[this.db._name][tableName];

    setFields = setFields.replace(/[\'\"\(\)]|/g, '');
    setFields = setFields.split(', ');
    for (i = 0; i < setFields.length; i++) {
      setFields[i] = setFields[i].replace(/\s*=\s*/, '=');
      setFields[i] = setFields[i].split('=');
    }

    for (i = 0; i < tableData.length; i++) {
      if (!whereLeft || tableData[i][whereLeft] === whereRight) {
        for (j = 0; j < setFields.length; j++) {
          tableData[i][setFields[j][0]] = setFields[j][1];
        }
        rowsAffected++;
      }
    }

    callback(this, new MockSQLResultSet([], rowsAffected));
    return;
  }

  // DELELTE
  else if (sqlStatement.substring(0, 11) === 'DELETE FROM') {
    statementParts = sqlStatement.match(/DELETE\sFROM\s([\w-_]+?)\s+WHERE\s+([\w-_]+?)\s*=\s*(.*?)$/);
    tableName = statementParts[1];
    whereLeft = statementParts[2];
    whereRight = statementParts[3];
    if (!isNaN(whereRight)) {
      whereRight = parseInt(whereRight);
    } else {
      whereRight = whereRight.replace(/[\"\']/g, '');
    }

    rowsAffected = 0;
    tableData = mockSQLStorage[this.db._name][tableName];

    for (i = 0; i < tableData.length; i++) {
      if (!whereLeft || tableData[i][whereLeft] === whereRight) {
        tableData.splice(i--,1);
        rowsAffected++;
      }
    }

    callback(this, new MockSQLResultSet([], rowsAffected));
    return;
  }

  // Other statements
  var parsedSql = SQLParser.parse(sqlStatement);
  var outputData = [];
  // SELECT statements
  if (parsedSql instanceof SQLParser.nodes.Select) {
    tableData = mockSQLStorage[this.db._name][parsedSql.source.name.value];
    tableDef = mockSQLStorageDef[this.db._name][parsedSql.source.name.value];
    var limit = (parsedSql.limit === null) ? undefined : parsedSql.limit.value.value;
    var addedItem;
    // iterate through table data
    for (i = 0; i < tableData.length; i++) {
      // only add to output data if no WHERE clause or it matches the WHERE clause
      if (!parsedSql.where || itemMatchesCondition(tableData[i], parsedSql.where.conditions)) {
        addedItem = {};
        // iterate through all fields that should be selected
        for (field in parsedSql.fields) {
          if (parsedSql.fields.hasOwnProperty(field)) {
            // if star is used, add all fields to the addedItem
            if (parsedSql.fields[field] instanceof SQLParser.nodes.Star) {
              for (var key in tableDef) {
                if (tableData[i].hasOwnProperty(key)) {
                  addedItem[key] = tableData[i][key];
                }
              }
            // no star but actual field name stated
            } else {
              var fieldName = parsedSql.fields[field].field.value;
              if (tableDef.hasOwnProperty(fieldName)) {
                addedItem[fieldName] = tableData[i][fieldName];
              } else {
                // TODO error handling!
              }
            }
          }
        }
        outputData.push(addedItem);
        // break the loop if the limit is reached
        if (limit !== undefined && outputData.length >= limit) {
          break;
        }
      }
    }

    // Order the output data
    if (parsedSql.order) {
      var orderings = parsedSql.order.orderings;
      outputData.sort(function (a, b) {
        // Iterate through the orderings
        for (var i = 0; i < orderings.length; i++) {
          var value = orderings[i].value.value;
          // Direction offset for descending sorting
          var directionOffset = (orderings[i].direction === 'ASC') ? 0 : 2;
          // return
          if (a[value] > b[value]) {
            return 1 - directionOffset;
          }
          if (a[value] < b[value]) {
            return -1 + directionOffset;
          }
        }
        // If everything is the same return 0
        return 0;
      });
    }

    // TODO SELECT group
  }

  // TODO implementation of count

  if (callback !== undefined) {
    callback(this, new MockSQLResultSet(outputData));
  }
};


// result set object mock
var MockSQLResultSet = function (data, rowsAffected, insertId) {
  if (insertId !== undefined) {
    this.insertId = insertId;
  }
  this.rowsAffected = (rowsAffected === undefined) ? 0 : rowsAffected;
  this.rows = new MockSQLResultSetRowList(data);
};


// result set row list mock
var MockSQLResultSetRowList = function (data) {
  this._data = data;
};

MockSQLResultSetRowList.prototype.item = function (index) {
  return this._data[index];
};


// Function to check if item matches the condition
function itemMatchesCondition(item, condition) {
  // set left side of condition
  var left;
  // if left side is operation get the result of it
  if (condition.left instanceof SQLParser.nodes.Op) {
    left = itemMatchesCondition(item, condition.left);
  } else {
    left = condition.left;
  }
  // set right side of condition
  var right;
  // if left side is operation get the result of it
  if (condition.right instanceof SQLParser.nodes.Op) {
    right = itemMatchesCondition(item, condition.right);
  } else {
    right = condition.right;
  }

  // return corresponding to the right operation
  switch(condition.operation) {
    case '=':
      return item[left.value] === right.value;
    case '!=':
      return item[left.value] !== right.value;
    case 'LIKE':

    case 'AND':
      return left && right;
    case 'OR':
      return left || right;
  }

}
