//-----------------------------------------------------------------------------
Astronome = (function(){
	'use strict';
	var path = Npm.require('path');
	var fs   = Npm.require('fs');
	var util = Npm.require('util');
	//-----------------------------------------------------------------------------
	var E = {
		ParamsMustBeObject:{
			error		: 1473, // Copernic year of birth
			reason	: 'params must be an object'
		},
		WrongSourcePath:{
			error		: 1474,
			reason	: 'sourcePath must be a string'
		},
		SourceNotFound:{
			error		: 1475,
			reason	: 'directory at sourcePath not found'
		},
		InvalidDirectoryCollection:{
			error		: 1476,
			reason	: 'directoryCollection must be a valid Meteor Collection'
		},
		InvalidFileCollection:{
			error		: 1477,
			reason	: 'fileCollection must be a valid Meteor Collection'
		},
		MissingDirectoryInDatabase:{
			error		: 1479,
			reason	: 'could not find tracked directory in database'
		},
		CorruptedDirectoryInDatabase:{
			error		: 1480,
			reason	: 'directory in database is corrupted (has no "astr" key)'
		},
		FailedToInsertDirectoryInDatabase:{
			error		: 1481,
			reason	: 'failed to insert directory in database'
		},
		FailedToWriteIdTrackerFile:{
			error		: 1482,
			reason	: 'failed to create and write to IdTracker file'
		},
		FailedToInsertFileInDatabase:{
			error		: 1483,
			reason	: 'failed to insert file in database'
		},
		FailedToParseKnownSubDirectory:{
			error		: 1484,
			reason	: 'cannot parse a known subdirectory as a source'
		},
		FailedToForgetNotSourceDirectory:{
			error		: 1485,
			reason	: 'cannot forget a directory that is not a source'
		},
		DuplicateDirectoryInDatabase:{
			error		: 1486,
			reason	: 'Directory is present multiple times in database'
		}
	};
	//-----------------------------------------------------------------------------
	var throwMeteorError = function(e, details){
		//throw new Meteor.Error(e.error, '[Astronome: '+e.reason+details?(' - '+details):''+']', details?details:'');
		var d=details?details:'';
		throw new Meteor.Error(e.error, '[Astronome] '+e.reason+':'+d, d);
	};
	//-----------------------------------------------------------------------------
	var logMeteorInfo = function(message){
		console.log('[Astronome] '+message);
	};
	//-----------------------------------------------------------------------------
	var defaultParams = {
		'sourcePath'							: null,
		'directoryCollection'			: null,
		'fileCollection'					: null,
		'idFilename'							: '.astronomeid',
		'onDirectoryAddedBeforeCB': null,
		'onDirectoryAddedAfterCB'	: null,
		'onDirectoryDeletedCB'		: null,
		'onDirectoryMovedCB'			: null,
		'onDirectoryForgottenCB'	: null,
		'onFileAddedBeforeCB'			: null,
		'onFileAddedAfterCB'			: null,
		'onFileDeletedCB'					: null,
		'onFileChangedCB'					: null,
		'onFileForgottenCB'				: null
	};
	//-----------------------------------------------------------------------------
	var checkParams = function(params){
		if(params && typeof params === 'object' && !util.isArray(params) ){

			var keys = Object.keys(defaultParams);
			for (var i = 0; i < keys.length; i++) {
				var k = keys[i];
				if (params[k] == undefined)
					params[k] = defaultParams[k];
			}

			if(typeof params.sourcePath !== 'string')
				throwMeteorError(E.WrongSourcePath, params.sourcePath);
			if(params.sourcePath.substr(-1) != path.sep)
				params.sourcePath += path.sep;
			if(!fs.existsSync(params.sourcePath))
				throwMeteorError(E.SourceNotFound, params.sourcePath);
			if(!params.directoryCollection || typeof params.directoryCollection !== 'object' || util.isArray(params.directoryCollection) || typeof params.directoryCollection._makeNewID !== 'function')
				throwMeteorError(E.InvalidDirectoryCollection);
			if(!params.fileCollection || typeof params.fileCollection !== 'object' || util.isArray(params.fileCollection) || typeof params.fileCollection._makeNewID !== 'function')
				throwMeteorError(E.InvalidFileCollection);
			return params;
		}else{
			throwMeteorError(E.ParamsMustBeObject);
		}
	};
	//-----------------------------------------------------------------------------
	var getKnownSourceDirectory = function(p){
		var idPath = p.sourcePath+p.idFilename;
		if( fs.existsSync(idPath) ){
			var dirId = ''+fs.readFileSync(idPath);
			var dir = p.directoryCollection.findOne(dirId);
			if(!dir)
				throwMeteorError(E.MissingDirectoryInDatabase, p.sourcePath);
			if(!dir.astr)
				throwMeteorError(E.CorruptedDirectoryInDatabase);
			return dir;
		}
		return null;
	};
	//-----------------------------------------------------------------------------
	var processDir = function(p, parentdir, sDirRelPath){
		var idPath = p.sourcePath+sDirRelPath+p.idFilename;
		var fullpath = p.sourcePath+sDirRelPath;
		var bRootDir = (sDirRelPath==='');
		var dirId;
		var dir=null;
		if(!fs.existsSync(idPath)){
			//console.log("processing new "+fullpath);
			if( bRootDir || !p.onDirectoryAddedBeforeCB || p.onDirectoryAddedBeforeCB(fullpath) ){
				var MatchingDirs = p.directoryCollection.find({"astr.dirPath":fullpath}).fetch();
				switch(MatchingDirs.length){
					case 0:
						dirId = p.directoryCollection.insert({
							'astr':{
								'sourceId'					: p.astr.sourceId,
								'parentId'					: p.astr.parentDir._id,
								'dirPath'						: fullpath
							}
						});
						if(!dirId){
							throwMeteorError(E.FailedToInsertDirectoryInDatabase);
						}
						break;
					case 1:
						dirId = MatchingDirs[0]._id;
						logMeteorInfo("Taking id "+dirId+" from existing record in database for "+fullpath);
						break;
					default:	
						throwMeteorError(E.DuplicateDirectoryInDatabase);
				}
				dir = p.directoryCollection.findOne(dirId);
				if(!dir)
					throwMeteorError(E.MissingDirectoryInDatabase, fullpath);
				p.directoryCollection.update(dirId, {$set:{"astr.lastParsedTime":p.astr.updateTime}})
				if(!dir.astr)
					throwMeteorError(E.CorruptedDirectoryInDatabase);
				//console.log("writing id file "+idPath+" with content "+dirId);
				if(fs.writeFileSync(idPath, dirId)){
					throwMeteorError(E.FailedToWriteIdTrackerFile);
				}
				if(!bRootDir && p.onDirectoryAddedAfterCB){
					if(!p.onDirectoryAddedAfterCB(dir)){
						p.directoryCollection.remove(dirId);
						return null;
					}
				}
			}else{
				return null;
			}
		}else{
			dirId = ''+fs.readFileSync(idPath);
			dir = p.directoryCollection.findOne(dirId);
			if(!dir){
				var MatchingDirs = p.directoryCollection.find({"astr.dirPath":fullpath}).fetch();
				switch(MatchingDirs.length){
					case 0:
						throwMeteorError(E.MissingDirectoryInDatabase, fullpath);
						break;
					case 1:
						dir = MatchingDirs[0];
						logMeteorInfo("Replacing not found id "+dirId+" on disk with "+dir._id+" from existing record in database for "+fullpath);
						dirId = dir._id;
						if(fs.writeFileSync(idPath, dir._id))
							throwMeteorError(E.FailedToWriteIdTrackerFile);
						break;
					default:
						throwMeteorError(E.DuplicateDirectoryInDatabase, fullpath);	
				}
			}
			if(!dir.astr)
				throwMeteorError(E.CorruptedDirectoryInDatabase);
			var olddirPath = dir.astr.dirPath;
			if(olddirPath !== fullpath){
				p.directoryCollection.update(dirId, {
					$set:{
						'astr.sourceId'				: p.astr.sourceId,
						'astr.parentId'				: p.astr.parentDir._id,
						'astr.dirPath'				: fullpath
					}
				});
				dir = p.directoryCollection.findOne(dirId);
				if(!dir)
					throwMeteorError(E.MissingDirectoryInDatabase, fullpath);
				if(!bRootDir && p.onDirectoryMovedCB){
					if(!p.onDirectoryMovedCB(dir, olddirPath)){
						p.directoryCollection.remove(dir._id);
						return null;
					}
				}
			}
			// In any case, update the last parsed time
			p.directoryCollection.update(dirId, {
					$set:{
						'astr.lastParsedTime'	: p.astr.updateTime
					}
			});
		}
		return dir;
	};
	//-----------------------------------------------------------------------------
	var extensionRegexp = new RegExp(/([^.]+)\.(.*)$/);
	//-----------------------------------------------------------------------------
	var processFile = function(p, dir, sFileName, mtime){
		if(sFileName===p.idFilename)
			return;
		var file;
		file = p.fileCollection.findOne(
			{
				$and:[
					//{"astr.sourceId"	: p.astr.sourceId}, if a dir is moved in a new source, why should we loose metadata ?
					{'astr.parentId'	: dir._id},
					{'astr.filename'	: sFileName}
				]
			}
		);
		if(file){
			//console.log("[processExistingFile] "+ sFileName+" last changed on "+file.astr.mtime+" vs "+mtime);
			// compare mtime from database to filesystem to check if it has changed or not
			if(p.onFileChangedCB && file.astr.mtime < mtime){
				if(!p.onFileChangedCB(file)){
					p.fileCollection.remove(file._id);
				}
			}
			// update lastParsedTime in order to detect deleted files
			p.fileCollection.update(file._id, {
					$set:{
						'astr.sourceId'				: p.astr.sourceId,
						'astr.mtime'					: mtime,
						'astr.lastParsedTime'	: p.astr.updateTime
					}
				}
			);
		}else{
			var result=sFileName.match(extensionRegexp);
			var basename = result[1];
			var extension = result[2];
			//console.log("[processNewFile] "+ sFileName);
			if(!p.onFileAddedBeforeCB || p.onFileAddedBeforeCB(sFileName, basename, extension)){
				//------------------------------
				var fileID = p.fileCollection.insert({
					'astr':{
						'sourceId'				: p.astr.sourceId,
						'parentId'				: dir._id,
						'filename'				: sFileName,
						'basename'				: basename,
						'extension'				: extension,
						'mtime'						: mtime,
						'lastParsedTime'	: p.astr.updateTime
					}
				});
				if(!fileID)
					throwMeteorError(E.FailedToInsertFileInDatabase);
				if(p.onFileAddedAfterCB){
					file = p.fileCollection.findOne(fileID);
					if(!p.onFileAddedAfterCB(file)){
						p.fileCollection.remove(file._id);
					}
				}
			}
		}
	};
	//-----------------------------------------------------------------------------
	var recursive_backup = function(objA, history){
		var objB;
		if(objA && Array.isArray(objA)){	
			objB = [];
		}else if(objA && typeof objA==="object"){
			objB = {};
		}else{
			return objA;
		}

		history.push({"a":objA, "b":objB });

		for (var attr in objA) {
			if (objA.hasOwnProperty(attr) && !defaultParams.hasOwnProperty(attr)){
				if(Object.getOwnPropertyDescriptor(objA, attr).writable){
					if(objA[attr] && typeof objA[attr]==="object"){
						var bFound=false;
						for(var h=0; h<history.length; ++h){
							if(history[h].a === objA[attr] ){
								objB[attr] = history[h].b;
								bFound=true;
							}
						}
						if(!bFound){
							objB[attr]=recursive_backup(objA[attr], history);
						}
					}else{
						objB[attr] = objA[attr];
					}
				}
			}
		}
		return objB;
	}
	//-----------------------------------------------------------------------------
	var recursive_restore = function(org, bkp, history){
		if(org===undefined)
			return;

		for(var h=0; h<history.length; ++h){
			if(history[h].b === bkp ){
				org = history[h].b;
				return;
			}
		}

		history.push({"b":bkp, "o":org});

		for (var attr in bkp) {
			if (bkp.hasOwnProperty(attr)){
				if(bkp[attr] && typeof bkp[attr]==="object"){
					var bAlreadyRestored=false;
					for(var h=0; h<history.length; ++h){
						if(history[h].b === bkp[attr] ){
							org[attr] = history[h].o;
							bAlreadyRestored=true;
						}
					}
					if(!bAlreadyRestored){
						recursive_restore(org[attr], bkp[attr], history);
					}
				}else{
					org[attr] = bkp[attr];
				}
			}
		}
	}
	//-----------------------------------------------------------------------------
	var backup = function(objA){
		return recursive_backup(objA, []);
	}
	//-----------------------------------------------------------------------------
	var restore = function(obj, backup){
		recursive_restore(obj, backup, []);
	}
	//-----------------------------------------------------------------------------
	var recursiveParseDir=function(p, sDirPath){
		var dir = p.astr.parentDir;
		//console.log("parsing dir "+sDirPath+" with id "+p.astr.parentDir._id);
		var elts = fs.readdirSync(p.sourcePath+sDirPath);
		for(var iElt=0; iElt<elts.length; ++iElt){
			var elt = elts[iElt];
			var relEltPath  = sDirPath+elt;
			var eltStats = fs.statSync(p.sourcePath+relEltPath);
			if(eltStats.isDirectory()){
				var subdir = processDir(p, dir, relEltPath+path.sep);
				if(subdir){
					var bkp = backup(p);
					p.astr.parentDir = subdir;
					recursiveParseDir(p, relEltPath+path.sep);
					restore(p, bkp);
				}
			}else{
				processFile(p, dir, elt, eltStats.mtime.getTime());
			}
		}
	};
	//-----------------------------------------------------------------------------
	var parse = function(params){
		var p=checkParams(params);
		
		delete p.astr;
		p.astr={
			'sourceId'		: 0,
			'parentDir'		: 0,
			'updateTime'	: Date.now()
		};

		var rootDir = processDir(p, null, '');
		if( rootDir.astr.parentId )
			throwMeteorError(E.FailedToParseKnownSubDirectory);
		
		p.astr.sourceId	 =  rootDir._id;
		p.astr.parentDir =  rootDir;
		
		recursiveParseDir(p, '');
		
		// All subdirs and files of this source that have not been updated have been deleted
		var dirsToDeleteIds			= [];
		var dirsWithNullSource	= [];
		var filesToDeleteIds		= [];
		var filesWithNullSource	= [];

		var sourceDirs = p.directoryCollection.find({'astr.sourceId':rootDir._id}).fetch();
		for(var iSourceDir=0; iSourceDir<sourceDirs.length; ++iSourceDir){
			var dir = sourceDirs[iSourceDir];
			if(dir.astr.lastParsedTime != p.astr.updateTime){
				if(!p.onDirectoryDeletedCB || p.onDirectoryDeletedCB(dir)){
					dirsToDeleteIds.push(dir._id);
				}else{
					dirsWithNullSource.push(dir._id);
				}
			}
		}
		var sourceFiles = p.fileCollection.find({'astr.sourceId':rootDir._id}).fetch();
		for(var iSourceFile=0; iSourceFile<sourceFiles.length; ++iSourceFile){
			var file = sourceFiles[iSourceFile];
			if(file.astr.lastParsedTime != p.astr.updateTime){
				if(!p.onFileDeletedCB || p.onFileDeletedCB(file)){
					filesToDeleteIds.push(file._id);
				}else{
					filesWithNullSource.push(file._id);
				}
			}
		}
		
		// Clean database 
		//logMeteorInfo("Cleaning Database");
		p.directoryCollection.remove({'_id':{'$in':dirsToDeleteIds}});
		p.fileCollection.remove({'_id':{'$in':filesToDeleteIds}});
		p.directoryCollection.update(
			{'_id':{'$in':dirsWithNullSource}},
			{
				$set:{
					'astr.sourceId' : null,
				}
			}
		);
		p.fileCollection.update(
			{'_id':{'$in':filesWithNullSource}},
			{
				$set:{
					'astr.sourceId' : null,
				}
			}
		);
	};
	//-----------------------------------------------------------------------------
	var forget = function(params){
		var p=checkParams(params);
		
		var rootDir = getKnownSourceDirectory(p);
		if( rootDir===null || rootDir.astr.parentId!==null ){
			throwMeteorError(E.FailedToForgetNotSourceDirectory, rootDir);
		}
		
		// forget files
		var sourceFiles = p.fileCollection.find({'astr.sourceId':rootDir._id}).fetch();
		for(var iSourceFile=0; iSourceFile<sourceFiles.length; ++iSourceFile){
			var file = sourceFiles[iSourceFile];
			if(p.onFileForgottenCB)
				p.onFileForgottenCB(file);
		}
		p.fileCollection.remove({'astr.sourceId':rootDir._id});
		
		// forget dirs
		var sourceDirs = p.directoryCollection.find({'astr.sourceId':rootDir._id}).fetch();
		for(var iSourceDir=0; iSourceDir<sourceDirs.length; ++iSourceDir){
			var dir = sourceDirs[iSourceDir];
			if(p.onDirectoryForgottenCB)
				p.onDirectoryForgottenCB(dir);
			try{
				fs.unlinkSync(dir.astr.dirPath+p.idFilename);
			}catch(e){}
		}
		p.directoryCollection.remove({'astr.sourceId':rootDir._id});
		
		// forget source
		try{
			fs.unlinkSync(rootDir.astr.dirPath+p.idFilename);
		}catch(e){}
		p.directoryCollection.remove(rootDir);
	};
	//-----------------------------------------------------------------------------
	//--------------------------- PUBLIC API --------------------------------------
	//-----------------------------------------------------------------------------
	return {
		//--------------------------------------------
		// Error messages
		'messages'				: E,
		//--------------------------------------------
		// Return a validated set of parameters built from the params you 
		// passed in input and adding default values to missing parameters.
		// Other API functions won't do it for you !
		'checkParams'		: function(params){
			return checkParams(params);
		},
		//--------------------------------------------
		// Manually parse the dir
		'parse'					: function(params){
			return parse(params);
		},
		//--------------------------------------------
		// Remove the id files in tracked dirs and call forget callbacks
		'forget'				: function(params){
			return forget(params);
		}
		//--------------------------------------------
	};
	//-----------------------------------------------------------------------------
})();
//-----------------------------------------------------------------------------