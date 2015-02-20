# mock-websql
A websql mock for simple unit testing.

This is a WORK IN PROGRESS and just covers some SQL query parts and use cases!
Because the WebSQL specification will no longer be maintained, this mock might
never be finished with all possible queries.

## Dependencies

The [SQL parser](https://github.com/forward/sql-parser) will be needed. It will
be installed automatically if bower is used, otherwise you have to clone/copy it
separately.

## Installation

You can install *mock-websql* via the Bower package manager with the following
terminal commands with the project folder being the current folder:

```bash
bower install mock-websql --save-dev
```

To use it in your unit test you have to reference the file
```bower_components/sql-parser/browser/sql-parser.js``` and
```bower_components/mock-websql/websql.js``` in your testing environment (e.g.
Karma/nodeunit etc.).

To install it manually just clone or download this repository, copy the
```websql.js``` file to a path of your liking and reference the file through
that path. The same has to be done for the SQL parser (using the browser
version). In the future there will be a file including all dependencies.
