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
		UserdataMustBeObject:{
			error		: 1478,
			reason	: 'userdata must be an object'
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
		}
	};
	//-----------------------------------------------------------------------------
	var throwMeteorError = function(e, details){
		//throw new Meteor.Error(e.error, '[Astronome: '+e.reason+details?(' - '+details):''+']', details?details:'');
		var d=details?details:'';
		throw new Meteor.Error(e.error, '[Astronome] '+e.reason+':'+d, d);
	};
	//-----------------------------------------------------------------------------
	var checkParams = function(params){
		if(params && typeof params === 'object' && !util.isArray(params) ){
			var p = {
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
			var keys = Object.keys(p);
			for (var i = 0; i < keys.length; i++) {
				var k = keys[i];
				if (params[k] !== undefined)
					p[k] = params[k];
			}
			if(typeof p.sourcePath !== 'string')
				throwMeteorError(E.WrongSourcePath);
			if(p.sourcePath.substr(-1) != path.sep)
				p.sourcePath += path.sep;
			if(!fs.existsSync(p.sourcePath))
				throwMeteorError(E.SourceNotFound);
			if(!p.directoryCollection || typeof p.directoryCollection !== 'object' || util.isArray(p.directoryCollection) || typeof p.directoryCollection._makeNewID !== 'function')
				throwMeteorError(E.InvalidDirectoryCollection);
			if(!p.fileCollection || typeof p.fileCollection !== 'object' || util.isArray(p.fileCollection) || typeof p.fileCollection._makeNewID !== 'function')
				throwMeteorError(E.InvalidFileCollection);
			return p;
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
	var processDir = function(p, parentdir, sDirRelPath, userdata){
		var idPath = p.sourcePath+sDirRelPath+p.idFilename;
		var fullpath = p.sourcePath+sDirRelPath;
		var bRootDir = (sDirRelPath==='');
		var dirId;
		var dir=null;
		if(!fs.existsSync(idPath)){
			//console.log("processing new "+fullpath);
			if( bRootDir || !p.onDirectoryAddedBeforeCB || p.onDirectoryAddedBeforeCB(userdata, fullpath) ){
				dirId = p.directoryCollection.insert({
					'astr':{
						'sourceId'					: userdata.astr.sourceId,
						'parentId'					: userdata.astr.parentDir._id,
						'dirPath'						: fullpath,
						'lastParsedTime'		: userdata.astr.updateTime
					}
				});
				if(!dirId){
					throwMeteorError(E.FailedToInsertDirectoryInDatabase);
				}
				dir = p.directoryCollection.findOne(dirId);
				if(!dir)
					throwMeteorError(E.MissingDirectoryInDatabase, fullpath);
				if(!dir.astr)
					throwMeteorError(E.CorruptedDirectoryInDatabase);
				//console.log("writing id file "+idPath+" with content "+dirId);
				if(fs.writeFileSync(idPath, dirId)){
					throwMeteorError(E.FailedToWriteIdTrackerFile);
				}
				if(!bRootDir && p.onDirectoryAddedAfterCB){
					p.onDirectoryAddedAfterCB(userdata, dir);
				}
			}else{
				return null;
			}
		}else{
			//console.log("processing existing "+fullpath);
			dirId = ''+fs.readFileSync(idPath);
			dir = p.directoryCollection.findOne(dirId);
			if(!dir)
				throwMeteorError(E.MissingDirectoryInDatabase, fullpath);
			if(!dir.astr)
				throwMeteorError(E.CorruptedDirectoryInDatabase);
			var olddirPath = dir.astr.dirPath;
			if(olddirPath !== fullpath){
				p.directoryCollection.update(dirId, {
					$set:{
						'astr.sourceId'				: userdata.astr.sourceId,
						'astr.parentId'				: userdata.astr.parentDir._id,
						'astr.dirPath'				: fullpath,
						'astr.lastParsedTime'	: userdata.astr.updateTime
					}
				});
				dir = p.directoryCollection.findOne(dirId);
				if(!dir)
					throwMeteorError(E.MissingDirectoryInDatabase, fullpath);
				if(!bRootDir && p.onDirectoryMovedCB){
					p.onDirectoryMovedCB(userdata, dir, olddirPath);
				}
			}else{
				// In any case, update the last parsed time
				p.directoryCollection.update(dirId, {
						$set:{
							'astr.lastParsedTime'	: userdata.astr.updateTime
						}
				});
			}
		}
		return dir;
	};
	//-----------------------------------------------------------------------------
	var processFile = function(p, dir, sFileName, mtime, userdata){
		if(sFileName===p.idFilename)
			return;
		var file;
		file = p.fileCollection.findOne(
			{
				$and:[
					//{"astr.sourceId"	: userdata.astr.sourceId}, if a dir is moved in a new source, why should we loose metadata ?
					{'astr.parentId'	: dir._id},
					{'astr.filename'	: sFileName}
				]
			}
		);
		if(file){
			//console.log("[processExistingFile] "+ sFileName+" last changed on "+file.astr.mtime+" vs "+mtime);
			// compare mtime from database to filesystem to check if it has changed or not
			if(p.onFileChangedCB && file.astr.mtime < mtime){
				p.onFileChangedCB(userdata, file);
			}
			// update lastParsedTime in order to detect deleted files
			p.fileCollection.update(file, {
					$set:{
						'astr.sourceId'				: userdata.astr.sourceId,
						'astr.mtime'					: mtime,
						'astr.lastParsedTime'	: userdata.astr.updateTime
					}
				}
			);
		}else{
			//console.log("[processNewFile] "+ sFileName);
			if(!p.onFileAddedBeforeCB || p.onFileAddedBeforeCB(userdata, sFileName)){
				//------------------------------
				var fileID = p.fileCollection.insert({
					'astr':{
						'sourceId'				: userdata.astr.sourceId,
						'parentId'				: dir._id,
						'filename'				: sFileName,
						'mtime'						: mtime,
						'lastParsedTime'	: userdata.astr.updateTime
					}
				});
				if(!fileID)
					throwMeteorError(E.FailedToInsertFileInDatabase);
				if(p.onFileAddedAfterCB){
					file = p.fileCollection.findOne(fileID);
					return p.onFileAddedAfterCB(userdata, file);
				}
			}
		}
		return false;
	};
	//-----------------------------------------------------------------------------
	var recursiveParseDir=function(p, sDirPath, userdata){
		var dir = userdata.astr.parentDir;
		//console.log("parsing dir "+sDirPath+" with id "+userdata.astr.parentDir._id);
		var elts = fs.readdirSync(p.sourcePath+sDirPath);
		for(var iElt=0; iElt<elts.length; ++iElt){
			var elt = elts[iElt];
			var relEltPath  = sDirPath+elt;
			var eltStats = fs.statSync(p.sourcePath+relEltPath);
			if(eltStats.isDirectory()){
				var oldUserdata = JSON.parse(JSON.stringify(userdata)); // This only copy fields, not prototypes or functions !
				var subdir = processDir(p, dir, relEltPath+path.sep, userdata);
				if(subdir){
					//console.log("recursing in "+relEltPath);
					userdata.astr.parentDir = subdir;
					recursiveParseDir(p, relEltPath+path.sep, userdata);
					userdata=oldUserdata;
				}
			}else{
				processFile(p, dir, elt, eltStats.mtime.getTime(), userdata);
			}
		}
	};
	//-----------------------------------------------------------------------------
	var parse = function(params, userdata){
		var p=checkParams(params);
		
		if(!userdata)
			userdata={};
		else if(typeof userdata !== 'object' || util.isArray(userdata))
			throwMeteorError(E.UserdataMustBeObject);
		
		userdata.astr={
			'sourceId'		: 0,
			'parentDir'		: 0,
			'updateTime'	: Date.now()
		};

		var rootDir = processDir(p, null, '', userdata);
		if( rootDir.astr.parentId )
			throwMeteorError(E.FailedToParseKnownSubDirectory);
		
		userdata.astr.sourceId			=  rootDir._id;
		userdata.astr.parentDir =  rootDir;
		
		recursiveParseDir(p, '', userdata);
		
		// All subdirs and files of this source that have not been updated have been deleted
		var dirsToDeleteIds			= [];
		var dirsWithNullSource	= [];
		var filesToDeleteIds		= [];
		var filesWithNullSource	= [];

		var sourceDirs = p.directoryCollection.find({'astr.sourceId':rootDir._id}).fetch();
		for(var iSourceDir=0; iSourceDir<sourceDirs.length; ++iSourceDir){
			var dir = sourceDirs[iSourceDir];
			if(dir.astr.lastParsedTime != userdata.astr.updateTime){
				if(!p.onDirectoryDeletedCB || p.onDirectoryDeletedCB(userdata, dir)){
					dirsToDeleteIds.push(dir._id);
				}else{
					dirsWithNullSource.push(dir._id);
				}
			}
		}
		var sourceFiles = p.fileCollection.find({'astr.sourceId':rootDir._id}).fetch();
		for(var iSourceFile=0; iSourceFile<sourceFiles.length; ++iSourceFile){
			var file = sourceFiles[iSourceFile];
			if(file.astr.lastParsedTime != userdata.astr.updateTime){
				if(!p.onFileDeletedCB || p.onFileDeletedCB(userdata, file)){
					filesToDeleteIds.push(file._id);
				}else{
					filesWithNullSource.push(file._id);
				}
			}
		}
		
		// Clean database 
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
	var forget = function(params, userdata){
		var p=checkParams(params);
		if(!userdata)
			userdata={};
		else if(typeof userdata !== 'object' || util.isArray(userdata))
			throwMeteorError(E.UserdataMustBeObject);
		
		var rootDir = getKnownSourceDirectory(p);
		if( rootDir===null || rootDir.astr.parentId!==null ){
			throwMeteorError(E.FailedToForgetNotSourceDirectory);
		}
		
		// forget files
		var sourceFiles = p.fileCollection.find({'astr.sourceId':rootDir._id}).fetch();
		for(var iSourceFile=0; iSourceFile<sourceFiles.length; ++iSourceFile){
			var file = sourceFiles[iSourceFile];
			if(p.onFileForgottenCB)
				p.onFileForgottenCB(userdata, file);
		}
		p.fileCollection.remove({'astr.sourceId':rootDir._id});
		
		// forget dirs
		var sourceDirs = p.directoryCollection.find({'astr.sourceId':rootDir._id}).fetch();
		for(var iSourceDir=0; iSourceDir<sourceDirs.length; ++iSourceDir){
			var dir = sourceDirs[iSourceDir];
			if(p.onDirectoryForgottenCB)
				p.onDirectoryForgottenCB(userdata, dir);
			fs.unlinkSync(dir.astr.dirPath+p.idFilename);
		}
		p.directoryCollection.remove({'astr.sourceId':rootDir._id});
		
		// forget source
		fs.unlinkSync(rootDir.astr.dirPath+p.idFilename);
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
		'parse'					: function(params, userdata){
			return parse(params, userdata);
		},
		//--------------------------------------------
		// Remove the .id files in tracked dirs and call callbacks
		'forget'				: function(params, userdata){
			return forget(params, userdata);
		}
		//--------------------------------------------
	};
	//-----------------------------------------------------------------------------
})();
//-----------------------------------------------------------------------------