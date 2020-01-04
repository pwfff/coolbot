import path from 'path';

// https://github.com/tj/callsite
const callsite = function(): any {
  const orig = Error.prepareStackTrace;
  Error.prepareStackTrace = function(_, stack) {
    return stack;
  };

  const err = new Error();
  Error.captureStackTrace(err, arguments.callee);

  const stack = err.stack;
  Error.prepareStackTrace = orig;

  return stack;
};

(<any>require).find = function(moduleName: string) {
  if (moduleName[0] === '.') {
    const stack = callsite();
    for (var i in stack) {
      var filename = stack[i].getFileName();
      if (filename !== module.filename) {
        moduleName = path.resolve(path.dirname(filename), moduleName);
        break;
      }
    }
  }
  try {
    return require.resolve(moduleName);
  } catch (e) {
    return;
  }
};

/**
 * Removes a module from the cache. We need this to re-load our http_request !
 * see: http://stackoverflow.com/a/14801711/1148249
 */

(<any>require).decache = function(moduleName: string) {
  moduleName = (<any>require).find(moduleName);

  if (!moduleName) {
    return;
  }

  // Run over the cache looking for the files
  // loaded by the specified module name
  (<any>require).searchCache(moduleName, function(mod: any) {
    delete require.cache[mod.id];
  });

  // Remove cached paths to the module.
  // Thanks to @bentael for pointing this out.
  Object.keys((<any>module).constructor._pathCache).forEach(function(cacheKey) {
    if (cacheKey.indexOf(moduleName) > -1) {
      delete (<any>module).constructor._pathCache[cacheKey];
    }
  });
};

/**
 * https://github.com/dwyl/decache/blob/master/decache.js
 *
 * Runs over the cache to search for all the cached
 * files
 */
(<any>require).searchCache = function(moduleName: string, callback: any) {
  // Resolve the module identified by the specified name
  let mod = require.resolve(moduleName);
  const cache = require.cache[mod];
  const visited: any = {};

  // Check if the module has been resolved and found within
  // the cache no else so #ignore else http://git.io/vtgMI
  /* istanbul ignore else */
  if (mod && ((<any>mod) = require.cache[mod]) !== undefined) {
    // Recursively go over the results
    (function run(current: any) {
      visited[current.id] = true;
      // Go over each of the module's children and
      // run over it
      current.children.forEach(function(child: any) {
        // ignore .node files, decachine native modules throws a
        // "module did not self-register" error on second require
        if (path.extname(child.filename) !== '.node' && !visited[child.id]) {
          run(child);
        }
      });

      // Call the specified callback providing the
      // found module
      callback(current);
    })(mod);
  }
};

export const decache = (<any>require).decache;
export default (<any>require).decache;
