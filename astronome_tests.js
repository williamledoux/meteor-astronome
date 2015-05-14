var path = Npm.require('path');
var fs = Npm.require('fs');
var Future = Npm.require('fibers/future');
var recursive = Npm.require('recursive-fs');
//-------------------------------------------
//*/////////////////////////////////////////////////
//-------------------------------------------
// The tests dir is the only one that will not make the test 
// restart when changed, but will still be wiped out when closing 
// test server
var tmpdir  = path.resolve('../../../../../tests')+path.sep;
var sourceADir = tmpdir+"sourceA"+path.sep;
var sourceBDir = tmpdir+"sourceB"+path.sep;
var sourceCDir = tmpdir+"sourceC"+path.sep;
//-------------------------------------------
// Create collections and make sure they are empty
var Directories = new Meteor.Collection("Directories");
var Files		= new Meteor.Collection("Files");
Tinytest.add("Astronome - Init empty collections", function(test){
	Directories.remove({});
	Files.remove({}); 
	test.length(Directories.find().fetch(),0);
	test.length(Files.find().fetch(),0);
});
//-------------------------------------------
function sleep(timeout){
	var f = new Future();
	Meteor.setTimeout(function(){
		f.return();
	},timeout);
	f.wait();
}
//-------------------------------------------
var ShouldNotBeCalled = function(test, cbname){
	return function(){
		console.log(cbname+" should not have been called with the following arguments:");
		console.log(arguments);
		test.fail(cbname+" should not have been called (see log for arguments)");
	};
};
//-------------------------------------------
var getDefaultParams = function(test, sourcePath){
	return Astronome.checkParams({
		'sourcePath'							: sourcePath,
		'directoryCollection'			: Directories,
		'fileCollection'					: Files,
		'onDirectoryAddedBeforeCB': ShouldNotBeCalled(test, "onDirectoryAddedBeforeCB"),
		'onDirectoryAddedAfterCB'	: ShouldNotBeCalled(test, "onDirectoryAddedAfterCB"),
		'onDirectoryDeletedCB'		: ShouldNotBeCalled(test, "onDirectoryDeletedCB"),
		'onDirectoryMovedCB'			: ShouldNotBeCalled(test, "onDirectoryMovedCB"),
		'onFileAddedBeforeCB'			: ShouldNotBeCalled(test, "onFileAddedBeforeCB"),
		'onFileAddedAfterCB'			: ShouldNotBeCalled(test, "onFileAddedAfterCB"),
		'onFileDeletedCB'					: ShouldNotBeCalled(test, "onFileDeletedCB"),
		'onFileChangedCB'					: ShouldNotBeCalled(test, "onFileChangedCB"),
		'idFilename'							: '.astronomeid'
	});
};
//-------------------------------------------
// Create test dir
Tinytest.add("Astronome - Init test directory", function(test){
	(function(){
		var future = new Future();
		recursive.rmdirr(tmpdir, function(err){
			if(err && err.code!='ENOENT')
				throw err;
			fs.mkdirSync(tmpdir);
			fs.mkdirSync(sourceADir);
			fs.mkdirSync(sourceBDir);
			fs.mkdirSync(sourceCDir);
			future.return();
		});
		future.wait();
	})();
	var params;
	params = getDefaultParams(null, sourceADir);
	test.isFalse(fs.existsSync(params.sourcePath+params.idFilename));
	params = getDefaultParams(null, sourceBDir);
	test.isFalse(fs.existsSync(params.sourcePath+params.idFilename));
});
//-----------------------------------------------------------------------------
//---------------------------- HELPERS ----------------------------------------
//-----------------------------------------------------------------------------
function IsParamsMustBeObjectError(actual)								{ if(actual.error === Astronome.messages.ParamsMustBeObject.error)								{ return true; } else { console.log(actual);	return false; } }
function IsWrongSourcePathError(actual)										{ if(actual.error === Astronome.messages.WrongSourcePath.error)										{ return true; } else { console.log(actual);	return false; } }
function IsSourceNotFoundError(actual)										{ if(actual.error === Astronome.messages.SourceNotFound.error)										{ return true; } else { console.log(actual);	return false; } }
function IsInvalidDirectoryCollectionError(actual)				{ if(actual.error === Astronome.messages.InvalidDirectoryCollection.error)				{ return true; } else { console.log(actual);	return false; } }
function IsInvalidFileCollectionError(actual)							{ if(actual.error === Astronome.messages.InvalidFileCollection.error)							{ return true; } else { console.log(actual);	return false; } }
function IsMissingDirectoryInDatabaseError(actual)				{ if(actual.error === Astronome.messages.MissingDirectoryInDatabase.error)				{ return true; } else { console.log(actual);	return false; } }
function IsFailedToInsertDirectoryInDatabaseError(actual)	{ if(actual.error === Astronome.messages.FailedToInsertDirectoryInDatabase.error)	{ return true; } else { console.log(actual);	return false; } }
function IsFailedToWriteIdTrackerFileError(actual)				{ if(actual.error === Astronome.messages.FailedToWriteIdTrackerFile.error)				{ return true; } else { console.log(actual);	return false; } }
function IsFailedToInsertFileInDatabaseError(actual)			{ if(actual.error === Astronome.messages.FailedToInsertFileInDatabase.error)			{ return true; } else { console.log(actual);	return false; } }
function IsFailedToParseKnownSubDirectoryError(actual)		{ if(actual.error === Astronome.messages.FailedToParseKnownSubDirectory.error)		{ return true; } else { console.log(actual);	return false; } }
function IsFailedToForgetNotSourceDirectoryError(actual)	{ if(actual.error === Astronome.messages.FailedToForgetNotSourceDirectory.error)	{ return true; } else { console.log(actual);	return false; } }
//-----------------------------------------------------------------------------
//-------------------------- CHECK PARAMS -------------------------------------
//-----------------------------------------------------------------------------
{

	//-------------------------------------------

	Tinytest.add("Astronome - checkParams - Minimal valid params must work", function(test){
		Astronome.checkParams({
			'sourcePath'						: tmpdir,
			'directoryCollection'		: Directories,
			'fileCollection'				: Files,
		});
	});
	
	//-------------------------------------------
	
	Tinytest.add("Astronome - checkParams - Full set of parameters must work", function(test){
		var params = getDefaultParams(null, sourceADir);
	});
	
	//-------------------------------------------
	
	Tinytest.add("Astronome - checkParams - Error if missing mandatory param", function(test){
		test.throws(function(){
			Astronome.checkParams({
				'directoryCollection'		: Directories,
				'fileCollection'				: Files
			});
		}, IsWrongSourcePathError);
		test.throws(function(){
			Astronome.checkParams({
				'sourcePath'						: tmpdir,
				'fileCollection'				: Files
			});
		}, IsInvalidDirectoryCollectionError);
		test.throws(function(){
			Astronome.checkParams({
				'sourcePath'							: tmpdir,
				'directoryCollection'			: Directories
			});
		}, IsInvalidFileCollectionError);
	});
	
	//-------------------------------------------
	
	Tinytest.add("Astronome - checkParams - Error if sourcePath is not a string", function(test){
		var params = getDefaultParams(null, sourceADir);
		params.sourcePath = null;
		test.throws(function(){ Astronome.checkParams(params); }, IsWrongSourcePathError);
		params.sourcePath = 1;
		test.throws(function(){ Astronome.checkParams(params); }, IsWrongSourcePathError);
	});
	
	//-------------------------------------------
	
	Tinytest.add("Astronome - checkParams - Error if sourcePath doesn't exist", function(test){
		var params = getDefaultParams(null, sourceADir);
		params.sourcePath = params.sourcePath+path.sep+'notexistingdir';
		test.throws(function(){ Astronome.checkParams(params); }, IsSourceNotFoundError);
	});
	
	//-------------------------------------------
	
	Tinytest.add("Astronome - checkParams - Error if dirs collection is not valid", function(test){
		var params = getDefaultParams(null, sourceADir);
		params.directoryCollection=null;
		test.throws(function(){ Astronome.checkParams(params); }, IsInvalidDirectoryCollectionError);
		params.directoryCollection="null";
		test.throws(function(){ Astronome.checkParams(params); }, IsInvalidDirectoryCollectionError);
		params.directoryCollection=1;
		test.throws(function(){ Astronome.checkParams(params); }, IsInvalidDirectoryCollectionError);
		params.directoryCollection={};
		test.throws(function(){ Astronome.checkParams(params); }, IsInvalidDirectoryCollectionError);
	});
	
	//-------------------------------------------

	Tinytest.add("Astronome - checkParams - Error if files collection is not valid", function(test){
		var params = getDefaultParams(null, sourceADir);
		params.fileCollection=null;
		test.throws(function(){ Astronome.checkParams(params); }, IsInvalidFileCollectionError);
		params.fileCollection="null";
		test.throws(function(){ Astronome.checkParams(params); }, IsInvalidFileCollectionError);
		params.fileCollection=1;
		test.throws(function(){ Astronome.checkParams(params); }, IsInvalidFileCollectionError);
		params.fileCollection={};
		test.throws(function(){ Astronome.checkParams(params); }, IsInvalidFileCollectionError);
		
	});
}
//-----------------------------------------------------------------------------
//------------------------------ PARSE ----------------------------------------
//-----------------------------------------------------------------------------
{
	var checkDirectoryState = function(test, idFilename, parentdirname, dirname, dir){
		//check the dir is present in DB
		test.equal(Directories.find(dir).count(), 1);
		//check the id file is okay
		test.equal(dir._id, ""+fs.readFileSync(dir.astr.dirPath+idFilename));
		//check the dir path seems okay too
		test.notEqual(dir.astr.dirPath.indexOf(dirname),-1, "dir path is wrong");
		if(parentdirname){
			//check that we can find its parent
			parentDirectory = Directories.findOne(dir.astr.parentId);
			test.isNotNull(parentDirectory, "could not find parent");
			//check the parent dir id is okay too
			test.equal(parentDirectory._id, ""+fs.readFileSync(parentDirectory.astr.dirPath+idFilename), "dir's parent's id file doesn't contain the id that is in db");
			// test if the parent dir path is okay
			test.notEqual(dir.astr.dirPath.indexOf(parentdirname),-1, "dir's parent path is wrong");
		}
	};

	//-------------------------------------------
	
	Tinytest.add("Astronome - parse - parsing: should add source dir to database without calling callbacks", function(test){
		var params = getDefaultParams(test, sourceADir);
		Astronome.parse(params);
		test.length(Directories.find().fetch(),1);
		var id = ""+fs.readFileSync(params.sourcePath+params.idFilename);
		var dir = Directories.findOne(id);
		test.equal(id, dir._id);
	});
	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - mkdir dirA + parse: should update db and call callbacks with correct userdata", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		// Create the directory:
		test.isUndefined(fs.mkdirSync(sourceADir+'dirA'));
		//---
		// Parse
		var params = getDefaultParams(test, sourceADir);
		params.foo=42;
		params.onDirectoryAddedBeforeCB = CBW.wrapCB("onDirectoryAddedBeforeCB", [0], true);
		params.onDirectoryAddedAfterCB = CBW.wrapCB("onDirectoryAddedAfterCB", [1], function(dir, iCall){
			test.equal(this.foo, 42, "userdata was lost");
			checkDirectoryState(test, params.idFilename, "", "dirA", dir);
		});
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 0);
	});
	//-------------------------------------------

	Tinytest.add("Astronome - parse - parsing: shouldn't call any callback", function(test){
		var params = getDefaultParams(test, sourceADir);
		Astronome.parse(params);
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - mkdir dirB + parse: should update db and call callbacks only for dirB", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		// Create the directory:
		test.isUndefined(fs.mkdirSync(sourceADir+'dirB'));
		//---
		// Parse
		var params = getDefaultParams(test, sourceADir);
		params.onDirectoryAddedBeforeCB = CBW.wrapCB("onDirectoryAddedBeforeCB", [0], true);
		params.onDirectoryAddedAfterCB = CBW.wrapCB("onDirectoryAddedAfterCB", [1], function(dir, iCall){
			checkDirectoryState(test, params.idFilename, "", "dirB", dir);
		});
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
	});
	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - mkdir sub and sub sub dirs in A and B + parse: should only call the add callbacks for each dir", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		// Create the directories:
		test.isUndefined(fs.mkdirSync(sourceADir+'dirA/subC'));
		test.isUndefined(fs.mkdirSync(sourceADir+'dirA/subC/subsubD'));
		test.isUndefined(fs.mkdirSync(sourceADir+'dirB/subE'));
		test.isUndefined(fs.mkdirSync(sourceADir+'dirB/subE/subsubF'));
		//---
		// Parse
		var params = getDefaultParams(test, sourceADir);
		params.onDirectoryAddedBeforeCB = CBW.wrapCB("onDirectoryAddedBeforeCB", [0, 2, 4, 6], true);
		params.onDirectoryAddedAfterCB = CBW.wrapCB("onDirectoryAddedAfterCB", [1, 3, 5, 7], function(dir, iCall){
			switch(iCall){
				case 0: checkDirectoryState(test, params.idFilename, "dirA"		, "subC", dir); break;
				case 1: checkDirectoryState(test, params.idFilename, "subC"	, "subsubD", dir); break;
				case 2: checkDirectoryState(test, params.idFilename, "dirB"		, "subE", dir); break;
				case 3: checkDirectoryState(test, params.idFilename, "subE"	, "subsubF", dir); break;
				default:
					test.fail("unexpected iCall");
					break;
			}
		});
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
	});
	
	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - add a bunch of files + parse: should ask to add each one of them and change db", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		// Create the directory:
		test.isUndefined(fs.writeFileSync(sourceADir+'dirA/fileA','contentA'));
		test.isUndefined(fs.writeFileSync(sourceADir+'dirB/fileB','contentB'));
		test.isUndefined(fs.writeFileSync(sourceADir+'dirA/subC/fileC','contentC'));
		test.isUndefined(fs.writeFileSync(sourceADir+'dirA/subC/subsubD/fileD','contentD'));
		test.isUndefined(fs.writeFileSync(sourceADir+'dirB/subE/fileE','contentE'));
		test.isUndefined(fs.writeFileSync(sourceADir+'dirB/subE/subsubF/fileF','contentF'));
		//---
		// Parse
		var params = getDefaultParams(test, sourceADir);
		params.onFileAddedBeforeCB = CBW.wrapCB("onFileAddedBeforeCB", [0, 2, 4, 6, 8, 10], true);
		params.onFileAddedAfterCB = CBW.wrapCB("onFileAddedAfterCB", [1, 3, 5, 7, 9, 11], true);
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - mv child from B to A + parsing: should call the move dir callback with updated parent", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		// Create the directory:
		test.isUndefined(fs.renameSync(sourceADir+'dirB/subE', sourceADir+'dirA/subE'));
		//---
		// Parse
		var params = getDefaultParams(test, sourceADir);
		params.onDirectoryMovedCB = CBW.wrapCB("onDirectoryMovedCB", 2, function(args){
			var dir=args[0];
			var olddirPath=args[1];
			switch(args.iCall){
				case 0:
					test.notEqual(olddirPath.indexOf("dirB"),-1);
					checkDirectoryState(test, params.idFilename, "dirA", "subE", dir);
					break;
				case 1:
					test.notEqual(olddirPath.indexOf("subE"),-1);
					checkDirectoryState(test, params.idFilename, "subE", "subsubF", dir);
					break;
				default:
					test.fail("unexpected iCall");
					break;
			}
			
		}, true);
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - wait and modify a bunch of files + parse: should call the filechangeCB and update db", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		sleep(1000); // for now node's precision for mtime is the second, should be fixed in v0.12
		test.isUndefined(fs.appendFileSync(sourceADir+'dirA/fileA','modifiedcontentA'));
		test.isUndefined(fs.appendFileSync(sourceADir+'dirA/subC/fileC','modifiedcontentC'));
		//---
		var params = getDefaultParams(test, sourceADir);
		params.onFileChangedCB = CBW.wrapCB("onFileChangedCB", 2, true);
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - parsing: shouldn't call anything 2", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		var params = getDefaultParams(test, sourceADir);
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - delete subE and parsing: should call delete callbacks and update database", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		var params = getDefaultParams(test, sourceADir);

		var oldFolderCount = Directories.find({}).count();
		var oldFileCount = Files.find({}).count();
		test.isUndefined(fs.unlinkSync(sourceADir+'dirA/subE/fileE'));
		test.isUndefined(fs.unlinkSync(sourceADir+'dirA/subE/'+params.idFilename));
		test.isUndefined(fs.unlinkSync(sourceADir+'dirA/subE/subsubF/fileF'));
		test.isUndefined(fs.unlinkSync(sourceADir+'dirA/subE/subsubF/'+params.idFilename));
		test.isUndefined(fs.rmdirSync(sourceADir+'dirA/subE/subsubF'));
		test.isUndefined(fs.rmdirSync(sourceADir+'dirA/subE'));
		//---
		params.onDirectoryDeletedCB	= CBW.wrapCB("onDirectoryDeletedCB", 2, true);
		params.onFileDeletedCB		= CBW.wrapCB("onFileDeletedCB", 2, true);
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
		//---
		test.equal(Directories.find({}).count(), oldFolderCount-2, "the 2 deleted folders should have been removed from database");
		test.equal(Files.find({}).count(), oldFileCount-2, "the 2 deleted files should have been removed from database");
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - parsing sub dir: should throw error", function(test, onComplete){
		//---
		var params = getDefaultParams(test, sourceADir);
		params.sourcePath += "dirA"; 
		test.throws(function(){ Astronome.parse(params); }, IsFailedToParseKnownSubDirectoryError);
		onComplete();
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - mv child from one source to another: should call the move dir callback with updated parent and source", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		// Create the directory:
		test.isUndefined(fs.renameSync(sourceADir+'dirB', sourceBDir+'dirB'));
		//---
		// Parse
		var params = getDefaultParams(test, sourceADir);
		params.onDirectoryDeletedCB = CBW.wrapCB("onDirectoryDeletedCB", 1, false); // don't remove it, just forget source
		params.onFileDeletedCB = CBW.wrapCB("onFileDeletedCB", 1, false);			// don't remove it, just forget source
		Astronome.parse(params);
		//---
		var paramsB = getDefaultParams(test, sourceBDir);
		paramsB.onDirectoryMovedCB = CBW.wrapCB("onDirectoryMovedCB", 1, true);
		Astronome.parse(paramsB);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
		//---
		test.equal(Directories.find({"astr.sourceId":null}).count(), 0, "no dir with a null source should remain");
		test.equal(Files.find({"astr.sourceId":null}).count(), 0, "no file with a null source should remain");
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - add deniedSource with a bunch of files + parse: should ask to add it and not change db", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//---
		// Create the directory:
		test.isUndefined(fs.mkdirSync(sourceADir+'deniedSource'));
		test.isUndefined(fs.writeFileSync(sourceADir+'deniedSource/deniedFile','deniedcontent'));
		//---
		// Parse
		var params = getDefaultParams(test, sourceADir);
		params.onDirectoryAddedBeforeCB = CBW.wrapCB("onDirectoryAddedBeforeCB", 1, false);
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
	});

	//-------------------------------------------

	Tinytest.addAsync("Astronome - parse - parsing: should ask again for deniedSource", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		// Parse
		var params = getDefaultParams(test, sourceADir);
		params.onDirectoryAddedBeforeCB = CBW.wrapCB("onDirectoryAddedBeforeCB", 1, false);
		Astronome.parse(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called
	});


}
//-----------------------------------------------------------------------------
//------------------------------ PARSE ----------------------------------------
//-----------------------------------------------------------------------------
{
	//-------------------------------------------
	Tinytest.add("Astronome - forget - forget unknown dir: should throw error and leave database untouched", function(test){
		var params;
		params = getDefaultParams(test, sourceCDir);
		test.throws(function(){Astronome.forget(params);}, IsFailedToForgetNotSourceDirectoryError);
	});
	//-------------------------------------------
	Tinytest.add("Astronome - forget - forget not source dir: should throw error and leave database untouched", function(test){
		var params;
		params = getDefaultParams(test, sourceADir);
		params.sourcePath += "dirA";
		test.throws(function(){ Astronome.forget(params); }, IsFailedToForgetNotSourceDirectoryError);
	});
	//-------------------------------------------
	Tinytest.addAsync("Astronome - forget - forget source dir: should remove all id files", function(test, onComplete){
		var CBW = new CallbacksWatcher(test);
		//Forget
		var params;
		params = getDefaultParams(test, sourceADir);
		params.onDirectoryForgottenCB = CBW.wrapCB("onDirectoryForgottenCB", 3, function(userdata, dir, iCall){
			switch(iCall){
				case 0: test.equal(dir.astr.dirPath, sourceADir+'dirA'+path.sep); break;
				case 1: test.equal(dir.astr.dirPath, sourceADir+'dirA'+path.sep+'subC'+path.sep); break;
				case 2: test.equal(dir.astr.dirPath, sourceADir+'dirA'+path.sep+'subC'+path.sep+'subsubD'+path.sep); break;
			}
		});
		params.onFileForgottenCB = CBW.wrapCB("onFileForgottenCB", 3, function(userdata, file, iCall){
			switch(iCall){
				case 0: test.equal(file.astr.filename, 'fileA'); break;
				case 1: test.equal(file.astr.filename, 'fileC'); break;
				case 2: test.equal(file.astr.filename, 'fileD'); break;
			}
		});
		Astronome.forget(params);
		//---
		CBW.wait(onComplete, 10); // wait to see if too many callbacks are called

		test.isFalse(fs.existsSync(sourceADir+params.idFilename), "id file of source's dir should have been removed");
		test.isFalse(fs.existsSync(sourceADir+'dirA'+params.idFilename), "id file of dirA  should have been removed");
		test.isFalse(fs.existsSync(sourceADir+'dirA'+path.sep+'subC'+path.sep+params.idFilename), "id file of subC  should have been removed");
		test.isFalse(fs.existsSync(sourceADir+'dirA'+path.sep+'subC'+path.sep+'subsubD'+path.sep+params.idFilename), "id file of subsubD  should have been removed");
	});
	//-------------------------------------------
}
//-----------------------------------------------------------------------------