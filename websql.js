// The data of the websql databases will be stored here!
var mockSQLStorage = {};


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

  if (mockSQLStorage[name] === undefined) {
    mockSQLStorage[name] = {};
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
  // TODO build statement with args
  var parsedSql = SQLParser.parse(sqlStatement);
  var outputData = [];

  console.log(SQLParser);
  console.log(parsedSql);
  // SELECT statements
  if (parsedSql instanceof SQLParser.nodes.Select) {
    var tableData = mockSQLStorage[this.db._name][parsedSql.source.name.value];
    var limit = (parsedSql.limit === null) ? undefined : parsedSql.limit.value.value;
    var addedItem;
    // iterate through table data
    for (var i = 0; i < tableData.length; i++) {
      // only add to output data if no WHERE clause or it matches the WHERE clause
      if (!parsedSql.where || itemMatchesCondition(tableData[i], parsedSql.where.conditions)) {
        addedItem = {};
        // iterate through all fields that should be selected
        for (var field in parsedSql.fields) {
          if (parsedSql.fields.hasOwnProperty(field)) {
            // if star is used, add all fields to the addedItem
            if (parsedSql.fields[field] instanceof SQLParser.nodes.Star) {
              // TODO use the table definition instead of the data object
              for (var key in tableData[i]) {
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

    // TODO SELECT orderby
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
