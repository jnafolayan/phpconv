# phpconv
Transpiles php project to html. 

## Usage
Install the packing with the command:
```
npm i phpconv --save-dev
```

To transpile a single php file to html, use the command:
```
phpconv <source-file> -o <destination-file>
```

To transpile a directory, use the command:
```
phpconv <source> -o <destination>
``` 

**Note:** When transpiling directories, files non-PHP files are simply copied into the destination folder. 

There is an option to watch directories and single files, to automate the transpiling process.
```
phpconv <source> -o <destination> --watch
```
