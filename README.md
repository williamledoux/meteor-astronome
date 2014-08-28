# astronome v0.1.0

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
				'onDirectoryAddedBeforeCB'	: function(userdata, directoryfullpath){ return true; }
				'onDirectoryAddedAfterCB'		: function(userdata, directory){ Directories.update(directory, {some:metadatas});},
				'onDirectoryDeletedCB'			: function(userdata, directory){ return true; },
				'onDirectoryMovedCB'				: function(userdata, directory, olddirectorypath){ },
				'onFileAddedBeforeCB'				: function(userdata, filefullpath){ return true},
				'onFileAddedAfterCB'				: function(userdata, file){ },
				'onFileDeletedCB'						: function(userdata, file){ },
				'onFileChangedCB'						: function(userdata, file){ },
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

#### sourcePath `required`
Must be a string containing the disk path of the existing 'source' directory (that is to be recursively tracked).
 
#### directoryCollection `required`
Must be a valid Meteor.Collection to store information on Directories 
 
#### fileCollection `required`
Must be a valid Meteor.Collection to store informations on Files
 
#### idFilename `default is ".astronomeid"`
Must be a string containing the name of the file that will be created in each subdirectory and contain the id of this subdirectory in the `directoryCollection`
 
#### onDirectoryAddedBeforeCB(userdata, fulldirectorypath) `optional`

 * Called by the `parse` function for each directory that is not tracked in `directoryCollection`.
 * Return value controls whether the subdirectory should be tracked (`true`) or not (`false`).
 * If this callback is not defined, all directories will be tracked.
 * Not called for the source directory (that is never tracked)
 * `userdata` as provided to the `parse` function.
 
#### onDirectoryAddedAfterCB(userdata, directory) `optional`
 
 * If defined, called by the `parse` function just after the `directory` object has been inserted to the `directoryCollection`.
 * Return value isn't used.
 * `userdata` as provided to the `parse` function.
 
#### onDirectoryDeletedCB(userdata, directory) `optional`

 * Called by the `parse` function for each tracked `directory` that is missing on the filesystem
 * Return value controls whether the `directory` is removed from database (`true`) or keeped with a null source (`false`).
 * If this callback is not defined, all missing directories will be removed from database.
 * `userdata` as provided to the `parse` function.
 
#### onDirectoryMovedCB(userdata, directory, oldDirectoryPath) `optional`

 * If defined, called by the `parse` function after a tracked `directory` that has been moved from `oldDirectoryPath` has been updated.
 * Return value isn't used.
 * `userdata` as provided to the `parse` function.
 
#### onDirectoryForgottenCB(userdata, directory) `optional`
 
 * If defined, called by the `forget` function just before a tracked `directory` is forgot. 
 * Return value isn't used.
 * `userdata` as provided to the `parse` function.
 
#### onFileAddedBeforeCB(userdata, filename) `optional`

 * Called by the `parse` function for each file that has no record in `fileCollection`.
 * File is named `filename` and its parent directory informations can be found in `userdata.astr.parentDir`.
 * Return value controls whether a record should be inserted in `fileCollection` for this file (`true`) or not (`false`).
 * If this callback is not defined, all files will be tracked.
 * No record is called for tracker files named `params.idFilename`.
 * `userdata` as provided to the `parse` function.
 
#### onFileAddedAfterCB(userdata, file) `optional`

 * If defined, called by the `parse` function just after the `file` object has been inserted to the `fileCollection`.
 * Return value isn't used.
 * `userdata` as provided to the `parse` function.
 
#### onFileDeletedCB(userdata, file) `optional`

 * Called by the `parse` function for each tracked `file` that is missing on the filesystem
 * Return value controls whether the `file` is removed from database (`true`) or keeped with a null source (`false`).
 * If this callback is not defined, all missing files will be removed from database.
 * `userdata` as provided to the `parse` function.
 
#### onFileChangedCB(userdata, ) `optional`

 * If defined, called by the `parse` function for each `file` whose modification time is newer than the last parse time
 * `userdata` as provided to the `parse` function.
 
#### onFileForgottenCB(userdata, file) `optional`
 
 * If defined, called by the `forget` function just before a tracked `file` is forgot.
 * Return value isn't used.
 * `userdata` as provided to the `parse` function.


### parse(params, userdata)

Recursively parse the folders of a given `source`, and update both `fileCollection` and `directoryCollection`.
Call callbacks defined in `params` for various usecases.
`userdata` can hold data needed by one of those callbacks. It can not objects containing prototypes or functions as the userdata may be deep cloned during the parsing

### forget(params, userdata)

Recursively remove all tracker files in the folders of a given `source`, and remove every record corresponding to elements of this source in both `fileCollection` and `directoryCollection`.
Call callbacks defined in `params` for various usecases.
`userdata` can hold anything that is needed by one of those callbacks.

### checkParams(params)

Will check that provided params are valid, and create default values for missing optionnal parameters.

## TODO

[ ] Remove `recursive-fs` dependency that is only used in tests
[ ] Add depth control `maxDepth` to recursive parsing
[ ] Add function to use filesystem events instead of periodical reparsing