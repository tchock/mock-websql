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
  // TODO build statement with args

  // CREATE
  if (sqlStatement.substring(0, 12) === 'CREATE TABLE') {
    var statementParts = sqlStatement.match(/CREATE TABLE (.*?) \((.*)\)/);
    var tableName = statementParts[1];
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
          case 'PRIMARY':
            tableRows[i].primary = true;
            break;
          case 'KEY':
            tableRows[i].key = true;
            break;
          case 'AUTOINCREMENT':
            tableRows[i].autoIncrement = true;
            break;
        }
      }
    }
    mockSQLStorageDef[this.db._name][tableName] = tableRows;

    // TODO Callback when CREATE TABLE finishes
    return;
  }

  // TODO drop

  // Other statements
  var parsedSql = SQLParser.parse(sqlStatement);
  var outputData = [];

  console.log(SQLParser);
  console.log(parsedSql);

  // CREATE statement


  // SELECT statements
  if (parsedSql instanceof SQLParser.nodes.Select) {
    var tableData = mockSQLStorage[this.db._name][parsedSql.source.name.value];
    var tableDef = mockSQLStorageDef[this.db._name][parsedSql.source.name.value];
    var limit = (parsedSql.limit === null) ? undefined : parsedSql.limit.value.value;
    var addedItem;
    // iterate through table data
    for (i = 0; i < tableData.length; i++) {
      // only add to output data if no WHERE clause or it matches the WHERE clause
      if (!parsedSql.where || itemMatchesCondition(tableData[i], parsedSql.where.conditions)) {
        addedItem = {};
        // iterate through all fields that should be selected
        for (var field in parsedSql.fields) {
          if (parsedSql.fields.hasOwnProperty(field)) {
            // if star is used, add all fields to the addedItem
            if (parsedSql.fields[field] instanceof SQLParser.nodes.Star) {
              // TODO use the table definition instead of the data object
              for (var key in tableDef) {
                if (tableData[i].hasOwnProperty(key)) {
                  addedItem[key] = tableData[i][key];
                }
              }
            // no star but actual field name stated
            } else {
              var fieldName = parsedSql.fields[field].field.value;
              // TODO check for definition instead of data object property
              // TODO error handling!
              if (tableData[i].hasOwnProperty(fieldName)) {
                addedItem[fieldName] = tableData[i][fieldName];
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

  // TODO implementation of insert into, update, delete, count, drop table if exists, create table

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
    // TODO LIKE
    case 'AND':
      return left && right;
    case 'OR':
      return left || right;
  }

}
