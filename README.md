# Astronome v0.2.0

Meteor server-side package for populating `Meteor.Collections` with informations on existing system directories and files, without touching (almost) anything, and without preventing normal interaction with those files and directories through filesystem. 

Usecases: indexing and adding metadatas to personnal files (pictures, videos, whatnot...) and still being able to manipulate them through filesystem.

## How it works

 * Manage records in a user-provided `Meteor.Collections` for subdirectories (recursively) and for files.
 * Callbacks on various events to allow better control of parsing.
 * Hidden file into each tracked subdirectory with its id, so that tracking isn't lost just because directory has been renamed or moved.
 * Files are matched by name: tracking will be lost if the file is renamed or moved to a different directory.

## Example

```javascript
	Directories = new Meteor.Collection("Directories");
	Files 	= new Meteor.Collection("Files");

	if (Meteor.isServer) {
		Meteor.startup(function () {
			// Create and check parameters
			var p = Astronome.checkParams({
				'sourcePath'						 		: "/mypictures/",
				'idFilename'								: '.astronomeid'
				'directoryCollection'				: Directories,
				'fileCollection'						: Files,
				'onDirectoryAddedBeforeCB'	: function(directoryfullpath){ return true; }
				'onDirectoryAddedAfterCB'		: function(directory){ Directories.update(directory, {some:metadatas});},
				'onDirectoryDeletedCB'			: function(directory){ return true; },
				'onDirectoryMovedCB'				: function(directory, olddirectorypath){ },
				'onFileAddedBeforeCB'				: function(filefullpath){ return true},
				'onFileAddedAfterCB'				: function(file){ },
				'onFileDeletedCB'						: function(file){ console.log(this.someUserData); },
				'onFileChangedCB'						: function(file){ },
				'someUserData'							: 42,
			});
			// Parse directory every minute
			Meteor.setInterval(function(){
				Astronome.parse(p);	
			}, 60000);
		}
	}
```

## API

### Errors
`Astronome` uses `Meteor.Error` to throw detailed errors

### Parameters

The parameters object mainly tells `Astronome` what collection to feed and what callbacks to call.
The fields described below are the one that will be read by `Astronome`.

#### sourcePath `required`
Must be a string containing the disk path of the existing 'source' directory (that is to be recursively tracked).
 
#### directoryCollection `required`
Must be a valid Meteor.Collection to store information on Directories 
 
#### fileCollection `required`
Must be a valid Meteor.Collection to store informations on Files
 
#### idFilename `default is ".astronomeid"`
Must be a string containing the name of the file that will be created in each subdirectory and contain the id of this subdirectory in the `directoryCollection`
 
#### onDirectoryAddedBeforeCB(fulldirectorypath) `optional`

 * Called by the `parse` function for each directory that is not tracked in `directoryCollection`.
 * Return value controls whether the subdirectory should be tracked (`true`) or not (`false`).
 * If this callback is not defined, all directories will be tracked.
 * Not called for the source directory (that is never tracked)
 
#### onDirectoryAddedAfterCB(directory) `optional`
 
 * If defined, called by the `parse` function just after the `directory` object has been inserted to the `directoryCollection`.
 * Return value isn't used.
 
#### onDirectoryDeletedCB(directory) `optional`

 * Called by the `parse` function for each tracked `directory` that is missing on the filesystem
 * Return value controls whether the `directory` is removed from database (`true`) or keeped with a null source (`false`).
 * If this callback is not defined, all missing directories will be removed from database.
 
#### onDirectoryMovedCB(directory, oldDirectoryPath) `optional`

 * If defined, called by the `parse` function after a tracked `directory` that has been moved from `oldDirectoryPath` has been updated.
 * Return value isn't used.
 
#### onDirectoryForgottenCB(directory) `optional`
 
 * If defined, called by the `forget` function just before a tracked `directory` is forgot. 
 * Return value isn't used.
 
#### onFileAddedBeforeCB(filename) `optional`

 * Called by the `parse` function for each file that has no record in `fileCollection`.
 * File is named `filename` and its parent directory informations can be found in `this.astr.parentDir`.
 * Return value controls whether a record should be inserted in `fileCollection` for this file (`true`) or not (`false`).
 * If this callback is not defined, all files will be tracked.
 * No record is called for tracker files named `params.idFilename`.
 
#### onFileAddedAfterCB(file) `optional`

 * If defined, called by the `parse` function just after the `file` object has been inserted to the `fileCollection`.
 * Return value isn't used.
 
#### onFileDeletedCB(file) `optional`

 * Called by the `parse` function for each tracked `file` that is missing on the filesystem
 * Return value controls whether the `file` is removed from database (`true`) or keeped with a null source (`false`).
 * If this callback is not defined, all missing files will be removed from database.
 
#### onFileChangedCB() `optional`

 * If defined, called by the `parse` function for each `file` whose modification time is newer than the last parse time
 
#### onFileForgottenCB(file) `optional`
 
 * If defined, called by the `forget` function just before a tracked `file` is forgot.
 * Return value isn't used.

#### Additional properties

Additionnal properties can be added to the parameters object, at user's discretion.
Those extra properties will be accessible in read/write in any of the callbacks through `this`.
Those properties are depth-linked. For example if you store the directory path in the `onDirectoryAddedBeforeCB`, and you read it in `onFileAddedBeforeCB` you will always get the correct parent's directory path, even if there were some nested subfolders that have been added between the two calls.
This is done by backuping recursively the extra own properties each time we parse deeper:

  * Extra properties should ideally be as flat and light as possible (for instance, not a meteor Collection !, which is big and recursive), otherwise it will be slow or not work at all (let me know).
  * If the param object inherits from something, the inherited properties won't get backuped. This can be exploited to store global user data that must not be depth-linked.

### parse(params)

Recursively parse the folders of a given `source`, and update both `fileCollection` and `directoryCollection`.
Call callbacks defined in `params` for various usecases. 

### forget(params)

Recursively remove all tracker files in the folders of a given `source`, and remove every record corresponding to elements of this source in both `fileCollection` and `directoryCollection`.
Call callbacks defined in `params` for various usecases.

### checkParams(params)

Will check that provided params are valid, and create default values for missing optionnal parameters.

## TODO

 * Remove `recursive-fs` dependency that is only used in tests
 * Add depth control `maxDepth` to recursive parsing
 * Add function to use filesystem events instead of periodical reparsing


Changelog
---------
 * 0.2.0
 	* Use additional params properties instead of userdata extra arg to all callbacks.
 * 0.1.0
 	* Update to official meteor packaging system