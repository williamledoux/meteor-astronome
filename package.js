Npm.depends({
	"recursive-fs": "0.1.3" // only for tests...
});

Package.describe({
  summary: "server side tools to maintain collections that track the system files and folders",
  version: "0.1.0",
  name: "williamledoux:astronome",
  git: "https://github.com/williamledoux/meteor-astronome.git",
});

Package.onUse(function (api) {
  api.export('Astronome', 'server');
  api.add_files('astronome.js', 'server');
});

Package.on_test(function (api) {
  api.use('williamledoux:astronome', 'server');
  api.use('williamledoux:tinytest-tools', 'server');
  api.use('tinytest', 'server');
  api.use('test-helpers', 'server');
  api.add_files('astronome_tests.js', 'server');
});