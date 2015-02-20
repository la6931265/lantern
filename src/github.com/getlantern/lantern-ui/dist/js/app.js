'use strict';

var app = angular.module('app', [
  'app.constants',
  'app.helpers',
  'pascalprecht.translate',
  'app.filters',
  'app.services',
  'app.directives',
  'app.vis',
  'ngSanitize',
  'ngResource',
  'ui.utils',
  'ui.showhide',
  'ui.validate',
  'ui.bootstrap',
  'ui.bootstrap.tpls'
  ])
  .directive('dynamic', function ($compile) {
    return {
      restrict: 'A',
      replace: true,
      link: function (scope, ele, attrs) {
        scope.$watch(attrs.dynamic, function(html) {
          ele.html(html);
          $compile(ele.contents())(scope);
        });
      }
    };
  })
  .config(function($tooltipProvider, $httpProvider, 
                   $resourceProvider, $translateProvider, DEFAULT_LANG) {

      $translateProvider.preferredLanguage(DEFAULT_LANG);

      $translateProvider.useStaticFilesLoader({
          prefix: './locale/',
          suffix: '.json'
      });
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common["X-Requested-With"];
    //$httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    $tooltipProvider.options({
      appendToBody: true
    });
  })
  // angular-ui config
  .value('ui.config', {
    animate: 'ui-hide',
  })
  .directive('splitArray', function() {
      return {
          restrict: 'A',
          require: 'ngModel',
          link: function(scope, element, attr, ngModel) {

              function fromUser(text) {
                  return text.split("\n");
              }

              function toUser(array) {                        
                  return array.join("\n");
              }

              ngModel.$parsers.push(fromUser);
              ngModel.$formatters.push(toUser);
          }
      };
  })
  .factory('Whitelist', ['$resource', function($resource) {
    return $resource('/whitelist', {list: 'original'});
  }])
  .run(function ($filter, $log, $rootScope, $timeout, $window, 
                 $translate, $http, apiSrvc, gaMgr, modelSrvc, ENUMS, EXTERNAL_URL, MODAL, CONTACT_FORM_MAXLEN) {

    var CONNECTIVITY = ENUMS.CONNECTIVITY,
        MODE = ENUMS.MODE,
        jsonFltr = $filter('json'),
        model = modelSrvc.model,
        prettyUserFltr = $filter('prettyUser'),
        reportedStateFltr = $filter('reportedState');

    // for easier inspection in the JavaScript console
    $window.rootScope = $rootScope;
    $window.model = model;

    $rootScope.EXTERNAL_URL = EXTERNAL_URL;

    $http.get('data/package.json').
      success(function(pkg, status, headers, config) {
      var version = pkg.version,
        components = version.split('.'),
        major = components[0],
        minor = components[1],
        patch = (components[2] || '').split('-')[0];
        $rootScope.lanternUiVersion = [major, minor, patch].join('.');
    }).error(function(data, status, headers, config) {
       console.log("Error retrieving UI version!");
    });

    $rootScope.model = model;
    $rootScope.DEFAULT_AVATAR_URL = 'img/default-avatar.png';
    $rootScope.CONTACT_FORM_MAXLEN = CONTACT_FORM_MAXLEN;

    angular.forEach(ENUMS, function(val, key) {
      $rootScope[key] = val;
    });

    $rootScope.reload = function () {
      location.reload(true); // true to bypass cache and force request to server
    };

    $rootScope.switchLang = function (lang) {
        $rootScope.lang = lang;
        $translate.use(lang);
    };

    $rootScope.changeLang = function(lang) {
      return $rootScope.interaction(INTERACTION.changeLang, {lang: lang});
    };

    $rootScope.openRouterConfig = function() {
      return $rootScope.interaction(INTERACTION.routerConfig);
    };

    $rootScope.openExternal = function(url) {
      if ($rootScope.mockBackend) {
        return $window.open(url);
      } else {
        return $rootScope.interaction(INTERACTION.url, {url: url});
      }
    };

    $rootScope.resetContactForm = function (scope) {
      if (scope.show) {
        var reportedState = jsonFltr(reportedStateFltr(model));
        scope.diagnosticInfo = reportedState;
      }
    };

    $rootScope.interactionWithNotify = function (interactionid, scope, reloadAfter) {
      var extra;
      if (scope.notify) {
        var diagnosticInfo = scope.diagnosticInfo;
        if (diagnosticInfo) {
          try {
            diagnosticInfo = angular.fromJson(diagnosticInfo);
          } catch (e) {
            $log.debug('JSON decode diagnosticInfo', diagnosticInfo, 'failed, passing as-is');
          }
        }
        extra = {
          context: model.modal,
          message: scope.message,
          diagnosticInfo: diagnosticInfo
        };
      }
      $rootScope.interaction(interactionid, extra).then(function () {
        if (reloadAfter) $rootScope.reload();
      });
    };

  });

'use strict';

function makeEnum(keys, extra) {
  var obj = {};
  for (var i=0, key=keys[i]; key; key=keys[++i]) {
    obj[key] = key;
  }
  if (extra) {
    for (var key in extra)
      obj[key] = extra[key];
  }
  return obj;
}

var DEFAULT_LANG = 'en_US',
    DEFAULT_DIRECTION = 'ltr',
    LANGS = {
      // http://www.omniglot.com/language/names.htm
      en_US: {dir: 'ltr', name: 'English'},
      de: {dir: 'ltr', name: 'Deutsch'},
      fr_FR: {dir: 'ltr', name: 'français (France)'},
      fr_CA: {dir: 'ltr', name: 'français (Canada)'},
      ca: {dir: 'ltr', name: 'català'},
      pt_BR: {dir: 'ltr', name: 'português'},
      fa_IR: {dir: 'rtl', name: 'پارسی'},
      zh_CN: {dir: 'ltr', name: '中文'},
      nl: {dir: 'ltr', name: 'Nederlands'},
      sk: {dir: 'ltr', name: 'slovenčina'},
      cs: {dir: 'ltr', name: 'čeština'},
      sv: {dir: 'ltr', name: 'Svenska'},
      ja: {dir: 'ltr', name: '日本語'},
      uk: {dir: 'ltr', name: 'Українська (діаспора)'},
      uk_UA: {dir: 'ltr', name: 'Українська (Україна)'},
      ru_RU: {dir: 'ltr', name: 'Русский язык'},
      es: {dir: 'ltr', name: 'español'},
      ar: {dir: 'rtl', name: 'العربية'}
    },
    GOOGLE_ANALYTICS_WEBPROP_ID = 'UA-21815217-2',
    GOOGLE_ANALYTICS_DISABLE_KEY = 'ga-disable-'+GOOGLE_ANALYTICS_WEBPROP_ID,
    loc = typeof location == 'object' ? location : undefined,
    // this allows the real backend to mount the entire app under a random path
    // for security while the mock backend can always use '/app':
    APP_MOUNT_POINT = loc ? loc.pathname.split('/')[1] : 'app',
    API_MOUNT_POINT = 'api',
    COMETD_MOUNT_POINT = 'cometd',
    COMETD_URL = loc && loc.protocol+'//'+loc.host+'/'+APP_MOUNT_POINT+'/'+COMETD_MOUNT_POINT,
    REQUIRED_API_VER = {major: 0, minor: 0}, // api version required by frontend
    REQ_VER_STR = [REQUIRED_API_VER.major, REQUIRED_API_VER.minor].join('.'),
    API_URL_PREFIX = ['', APP_MOUNT_POINT, API_MOUNT_POINT, REQ_VER_STR].join('/'),
    MODEL_SYNC_CHANNEL = '/sync',
    CONTACT_FORM_MAXLEN = 500000,
    INPUT_PAT = {
      // based on http://www.regular-expressions.info/email.html
      EMAIL: /^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
      EMAIL_INSIDE: /[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/,
      // from http://html5pattern.com/
      DOMAIN: /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/,
      IPV4: /((^|\.)((25[0-5])|(2[0-4]\d)|(1\d\d)|([1-9]?\d))){4}$/
    },
    EXTERNAL_URL = {
      rally: 'https://rally.org/lantern/donate',
      cloudServers: 'https://github.com/getlantern/lantern/wiki/Lantern-Cloud-Servers',
      autoReportPrivacy: 'https://github.com/getlantern/lantern/wiki/Privacy#wiki-optional-information',
      homepage: 'https://www.getlantern.org/',
      userForums: {
        en_US: 'https://groups.google.com/group/lantern-users-en',
        fr_FR: 'https://groups.google.com/group/lantern-users-fr',
        fr_CA: 'https://groups.google.com/group/lantern-users-fr',
        ar: 'https://groups.google.com/group/lantern-users-ar',
        fa_IR: 'https://groups.google.com/group/lantern-users-fa',
        zh_CN: 'https://lanternforum.greatfire.org/'
      },
      docs: 'https://github.com/getlantern/lantern/wiki',
      getInvolved: 'https://github.com/getlantern/lantern/wiki/Get-Involved',
      proxiedSitesWiki: 'https://github.com/getlantern/lantern-proxied-sites-lists/wiki',
      developers: 'https://github.com/getlantern/lantern'
    },
    // enums
    MODE = makeEnum(['give', 'get', 'unknown']),
    OS = makeEnum(['windows', 'linux', 'osx']),
    MODAL = makeEnum([
      'settingsLoadFailure',
      'unexpectedState', // frontend only
      'welcome',
      'authorize',
      'connecting',
      'notInvited',
      'proxiedSites',
      'lanternFriends',
      'finished',
      'contact',
      'settings',
      'confirmReset',
      'giveModeForbidden',
      'about',
      'sponsor',
      'sponsorToContinue',
      'updateAvailable',
      'scenarios'],
      {none: ''}),
    INTERACTION = makeEnum([
      'changeLang',
      'give',
      'get',
      'set',
      'lanternFriends',
      'friend',
      'reject',
      'contact',
      'settings',
      'reset',
      'proxiedSites',
      'about',
      'sponsor',
      'updateAvailable',
      'retry',
      'cancel',
      'continue',
      'close',
      'quit',
      'refresh',
      'unexpectedStateReset',
      'unexpectedStateRefresh',
      'url',
      'developer',
      'scenarios',
      'routerConfig']),
    SETTING = makeEnum([
      'lang',
      'mode',
      'autoReport',
      'runAtSystemStart',
      'systemProxy',
      'proxyAllSites',
      'proxyPort',
      'proxiedSites']),
    PEER_TYPE = makeEnum([
      'pc',
      'cloud',
      'laeproxy'
      ]),
    FRIEND_STATUS = makeEnum([
      'friend',
      'pending',
      'rejected'
      ]),
    CONNECTIVITY = makeEnum([
      'notConnected',
      'connecting',
      'connected']),
    GTALK_STATUS = makeEnum([
      'offline',
      'unavailable',
      'idle',
      'available']),
    SUGGESTION_REASON = makeEnum([
      'runningLantern',
      'friendedYou'
      ]),
    ENUMS = {
      MODE: MODE,
      OS: OS,
      MODAL: MODAL,
      INTERACTION: INTERACTION,
      SETTING: SETTING,
      PEER_TYPE: PEER_TYPE,
      FRIEND_STATUS: FRIEND_STATUS,
      CONNECTIVITY: CONNECTIVITY,
      GTALK_STATUS: GTALK_STATUS,
      SUGGESTION_REASON: SUGGESTION_REASON
    };

if (typeof angular == 'object' && angular && typeof angular.module == 'function') {
  angular.module('app.constants', [])
    .constant('DEFAULT_LANG', DEFAULT_LANG)
    .constant('DEFAULT_DIRECTION', DEFAULT_DIRECTION)
    .constant('LANGS', LANGS)
    .constant('API_MOUNT_POINT', API_MOUNT_POINT)
    .constant('APP_MOUNT_POINT', APP_MOUNT_POINT)
    .constant('COMETD_MOUNT_POINT', COMETD_MOUNT_POINT)
    .constant('COMETD_URL', COMETD_URL)
    .constant('MODEL_SYNC_CHANNEL', MODEL_SYNC_CHANNEL)
    .constant('CONTACT_FORM_MAXLEN', CONTACT_FORM_MAXLEN)
    .constant('INPUT_PAT', INPUT_PAT)
    .constant('EXTERNAL_URL', EXTERNAL_URL)
    .constant('ENUMS', ENUMS)
    .constant('MODE', MODE)
    .constant('OS', OS)
    .constant('MODAL', MODAL)
    .constant('INTERACTION', INTERACTION)
    .constant('SETTING', SETTING)
    .constant('PEER_TYPE', PEER_TYPE)
    .constant('FRIEND_STATUS', FRIEND_STATUS)
    .constant('CONNECTIVITY', CONNECTIVITY)
    .constant('GTALK_STATUS', GTALK_STATUS)
    .constant('SUGGESTION_REASON', SUGGESTION_REASON)
    // frontend-only
    .constant('GOOGLE_ANALYTICS_WEBPROP_ID', GOOGLE_ANALYTICS_WEBPROP_ID)
    .constant('GOOGLE_ANALYTICS_DISABLE_KEY', GOOGLE_ANALYTICS_DISABLE_KEY)
    .constant('LANTERNUI_VER', window.LANTERNUI_VER) // set in version.js
    .constant('REQUIRED_API_VER', REQUIRED_API_VER)
    .constant('API_URL_PREFIX', API_URL_PREFIX);
} else if (typeof exports == 'object' && exports && typeof module == 'object' && module && module.exports == exports) {
  module.exports = {
    DEFAULT_LANG: DEFAULT_LANG,
    DEFAULT_DIRECTION: DEFAULT_DIRECTION,
    LANGS: LANGS,
    API_MOUNT_POINT: API_MOUNT_POINT,
    APP_MOUNT_POINT: APP_MOUNT_POINT,
    COMETD_MOUNT_POINT: COMETD_MOUNT_POINT,
    COMETD_URL: COMETD_URL,
    MODEL_SYNC_CHANNEL: MODEL_SYNC_CHANNEL,
    CONTACT_FORM_MAXLEN: CONTACT_FORM_MAXLEN,
    INPUT_PAT: INPUT_PAT,
    EXTERNAL_URL: EXTERNAL_URL,
    ENUMS: ENUMS,
    MODE: MODE,
    OS: OS,
    MODAL: MODAL,
    INTERACTION: INTERACTION,
    SETTING: SETTING,
    PEER_TYPE: PEER_TYPE,
    FRIEND_STATUS: FRIEND_STATUS,
    CONNECTIVITY: CONNECTIVITY,
    GTALK_STATUS: GTALK_STATUS,
    SUGGESTION_REASON: SUGGESTION_REASON
  };
}

'use strict';

if (typeof inspect != 'function') {
  try {
    var inspect = require('util').inspect;
  } catch (e) {
    var inspect = function(x) { return JSON.stringify(x); };
  }
}

if (typeof _ != 'function') {
  var _ = require('../bower_components/lodash/lodash.min.js')._;
}

if (typeof jsonpatch != 'object') {
  var jsonpatch = require('../bower_components/jsonpatch/lib/jsonpatch.js');
}
var JSONPatch = jsonpatch.JSONPatch,
    JSONPointer = jsonpatch.JSONPointer,
    PatchApplyError = jsonpatch.PatchApplyError,
    InvalidPatch = jsonpatch.InvalidPatch;

function makeLogger(prefix) {
  return function() {
    var s = '[' + prefix + '] ';
    for (var i=0, l=arguments.length, ii=arguments[i]; i<l; ii=arguments[++i])
      s += (_.isObject(ii) ? inspect(ii, false, null, true) : ii)+' ';
    console.log(s);
  };
}

var log = makeLogger('helpers');

var byteDimensions = {P: 1024*1024*1024*1024*1024, T: 1024*1024*1024*1024, G: 1024*1024*1024, M: 1024*1024, K: 1024, B: 1};
function byteDimension(nbytes) {
  var dim, base;
  for (dim in byteDimensions) { // assumes largest units first
    base = byteDimensions[dim];
    if (nbytes > base) break;
  }
  return {dim: dim, base: base};
}

function randomChoice(collection) {
  if (_.isArray(collection))
    return collection[_.random(0, collection.length-1)];
  if (_.isPlainObject(collection))
    return randomChoice(_.keys(collection));
  throw new TypeError('expected array or plain object, got '+typeof collection);
}

function applyPatch(obj, patch) {
  patch = new JSONPatch(patch, true); // mutate = true
  patch.apply(obj);
}

function getByPath(obj, path) {
  try {
    return (new JSONPointer(path)).get(obj);
  } catch (e) {
    if (!(e instanceof PatchApplyError)) throw e;
  }
}

var _export = [makeLogger, byteDimension, randomChoice, applyPatch, getByPath];
if (typeof angular == 'object' && angular && typeof angular.module == 'function') {
  var module = angular.module('app.helpers', []);
  _.each(_export, function(func) {
    module.constant(func.name, func);
  });
} else if (typeof exports == 'object' && exports && typeof module == 'object' && module && module.exports == exports) {
  _.each(_export, function(func) {
    exports[func.name] = func;
  });
}

'use strict';

angular.module('app.filters', [])
  // see i18n.js for i18n filter
  .filter('upper', function() {
    return function(s) {
      return angular.uppercase(s);
    };
  })
  .filter('badgeCount', function() {
    return function(str, max) {
      var count = parseInt(str), max = max || 9;
      return count > max ? max + '+' : count;
    };
  })
  .filter('noNullIsland', function() {
    return function(peers) {
      return _.reject(peers, function (peer) {
        return peer.lat === 0.0 && peer.lon === 0.0;
      });
    };
  })
  .filter('prettyUser', function() {
    return function(obj) {
      if (!obj) return obj;
      if (obj.email && obj.name)
        return obj.name + ' <' + obj.email + '>'; // XXX i18n?
      return obj.email;
    };
  })
  .filter('prettyBytes', function($filter) {
    return function(nbytes, dimensionInput, showUnits) {
      if (_.isNaN(nbytes)) return nbytes;
      if (_.isUndefined(dimensionInput)) dimensionInput = nbytes;
      if (_.isUndefined(showUnits)) showUnits = true;
      var dimBase = byteDimension(dimensionInput),
          dim = dimBase.dim,
          base = dimBase.base,
          quotient = $filter('number')(nbytes / base, 1);
      return showUnits ? quotient+' '+dim // XXX i18n?
                       : quotient;
    };
  })
  .filter('prettyBps', function($filter) {
    return function(nbytes, dimensionInput, showUnits) {
      if (_.isNaN(nbytes)) return nbytes;
      if (_.isUndefined(showUnits)) showUnits = true;
      var bytes = $filter('prettyBytes')(nbytes, dimensionInput, showUnits);
      return showUnits ? bytes+'/'+'s' // XXX i18n?
                       : bytes;
    };
  })
  .filter('reportedState', function() {
    return function(model) {
      var state = _.cloneDeep(model);

      // omit these fields
      state = _.omit(state, 'mock', 'countries', 'global');
      delete state.location.lat;
      delete state.location.lon;
      delete state.connectivity.ip;

      // only include these fields from the user's profile
      if (state.profile) {
        state.profile = {email: state.profile.email, name: state.profile.name};
      }

      // replace these array fields with their lengths
      _.each(['/roster', '/settings/proxiedSites', '/friends'], function(path) {
        var len = (getByPath(state, path) || []).length;
        if (len) applyPatch(state, [{op: 'replace', path: path, value: len}]);
      });

      var peers = getByPath(state, '/peers');
      _.each(peers, function (peer) {
        peer.rosterEntry = !!peer.rosterEntry;
        delete peer.peerid;
        delete peer.ip;
        delete peer.lat;
        delete peer.lon;
      });

      return state;
    };
  })
  .filter('version', function() {
    return function(versionObj, tag, git) {
      if (!versionObj) return versionObj;
      var components = [versionObj.major, versionObj.minor, versionObj.patch],
          versionStr = components.join('.');
      if (!tag) return versionStr;
      if (versionObj.tag) versionStr += '-'+versionObj.tag;
      if (!git) return versionStr;
      if (versionObj.git) versionStr += ' ('+versionObj.git.substring(0, 7)+')';
      return versionStr;
    };
  });

'use strict';

angular.module('app.services', [])
  .service('modelSrvc', function($rootScope, apiSrvc, $window, MODEL_SYNC_CHANNEL,  flashlightStats) {
      var model = {},
        syncSubscriptionKey;

    $rootScope.validatedModel = false;

    // XXX use modelValidatorSrvc to validate update before accepting
    function handleSync(msg) {
      var patch = msg.data;
      // backend can send updates before model has been populated
      // https://github.com/getlantern/lantern/issues/587
      if (patch[0].path !== '' && _.isEmpty(model)) {
        //log.debug('ignoring', msg, 'while model has not yet been populated');
        return;
      }

      function updateModel() {
        var shouldUpdateInstanceStats = false;
        if (patch[0].path === '') {
            // XXX jsonpatch can't mutate root object https://github.com/dharmafly/jsonpatch.js/issues/10
            angular.copy(patch[0].value, model);
          } else {
            try {
                applyPatch(model, patch);
                for (var i=0; i<patch.length; i++) {
                    if (patch[i].path == "/instanceStats") {
                        shouldUpdateInstanceStats = true;
                        break;
                      }
                  }
                } catch (e) {
                  if (!(e instanceof PatchApplyError || e instanceof InvalidPatch)) throw e;
                  //log.error('Error applying patch', patch);
                  apiSrvc.exception({exception: e, patch: patch});
                }
            }
            flashlightStats.updateModel(model, shouldUpdateInstanceStats);
        }

        if (!$rootScope.validatedModel) { 
            $rootScope.$apply(updateModel()); 
            $rootScope.validatedModel = true 
        } else { 
            updateModel(); 
        }
      }

    syncSubscriptionKey = {chan: MODEL_SYNC_CHANNEL, cb: handleSync};

    return {
      model: model,
      sane: true
    };
  })
  .service('gaMgr', function ($window, GOOGLE_ANALYTICS_DISABLE_KEY, GOOGLE_ANALYTICS_WEBPROP_ID, modelSrvc) {
      var model = modelSrvc.model,
        ga = $window.ga;

    function stopTracking() {
      //log.debug('disabling analytics');
      //trackPageView('end'); // force the current session to end with this hit
      $window[GOOGLE_ANALYTICS_DISABLE_KEY] = true;
    }

    function startTracking() {
      //log.debug('enabling analytics');
      $window[GOOGLE_ANALYTICS_DISABLE_KEY] = false;
      trackPageView('start');
    }

    // start out with google analytics disabled
    // https://developers.google.com/analytics/devguides/collection/analyticsjs/advanced#optout
    stopTracking();

    // but get a tracker set up and ready for use if analytics become enabled
    // https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference
    ga('create', GOOGLE_ANALYTICS_WEBPROP_ID, {cookieDomain: 'none'});
    ga('set', {
      anonymizeIp: true,
      forceSSL: true,
      location: 'http://lantern-ui/',
      hostname: 'lantern-ui',
      title: 'lantern-ui'
    });

    function trackPageView(sessionControl) {
      var page = model.modal || '/';
      ga('set', 'page', page);
      ga('send', 'pageview', sessionControl ? {sessionControl: sessionControl} : undefined);
      //log.debug(sessionControl === 'end' ? 'sent analytics session end' : 'tracked pageview', 'page =', page);
    }

    return {
      stopTracking: stopTracking,
      startTracking: startTracking,
      trackPageView: trackPageView
    };
  })
  .service('apiSrvc', function($http, API_URL_PREFIX) {
    return {
      exception: function(data) {
        return $http.post(API_URL_PREFIX+'/exception', data);
      },
      interaction: function(interactionid, data) {
        var url = API_URL_PREFIX+'/interaction/'+interactionid;
        return $http.post(url, data);
      }
    };
  })
  .service('flashlightStats', function ($window) {
    // This service grabs stats from flashlight and adds them to the standard
    // model.
    var flashlightPeers = {};

    // connect() starts listening for peer updates
    function connect() {
      var source = new EventSource('http://127.0.0.1:15670/');
      source.addEventListener('message', function(e) {
        var data = JSON.parse(e.data);
        if (data.type == "peer") {
          var peer = data.data;
          peer.mode = 'get';
          flashlightPeers[peer.peerid] = peer;
        }
      }, false);
  
      source.addEventListener('open', function(e) {
        //$log.debug("flashlight connection opened");
      }, false);
  
      source.addEventListener('error', function(e) {
        if (e.readyState == EventSource.CLOSED) {
          //$log.debug("flashlight connection closed");
        }
      }, false);
    }
    
    // updateModel updates a model that doesn't include flashlight peers with
    // information about the flashlight peers, including updating aggregated
    // figure slike total bps.
    function updateModel(model, shouldUpdateInstanceStats) {
      for (var peerid in flashlightPeers) {
        var peer = flashlightPeers[peerid];
        
        // Consider peer connected if it's been less than x seconds since
        // lastConnected
        var lastConnected = Date.parse(peer.lastConnected);
        var delta = new Date().getTime() - Date.parse(peer.lastConnected);
        peer.connected = delta < 30000;
        
        // Add peer to model
        model.peers.push(peer);
        
        if (shouldUpdateInstanceStats) {
          // Update total bytes up/dn
          model.instanceStats.allBytes.rate += peer.bpsUpDn;
        }
      }
    }
    
    return {
      connect: connect,
      updateModel: updateModel,
    };
  });

'use strict';

app.controller('RootCtrl', ['$scope', '$http', 'flashlightStats', function($scope, $http, flashlightStats) {
    //flashlightStats.connect();
    $scope.currentModal = 'none';

    $scope.showModal = function(val) {
        $scope.currentModal = val;
    };

    $scope.closeModal = function() {
        $scope.currentModal = 'none';
    };

}]);

app.controller('UpdateAvailableCtrl', ['$scope', 'MODAL', function($scope, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function (modal) {
    $scope.show = modal === MODAL.updateAvailable;
  });
}]);

app.controller('ContactCtrl', ['$scope', 'MODAL', function($scope, MODAL) {
  $scope.show = false;
  $scope.notify = true; // so the view's interactionWithNotify calls include $scope.message and $scope.diagnosticInfo
  $scope.$watch('model.modal', function (modal) {
    $scope.show = modal === MODAL.contact;
    $scope.resetContactForm($scope);
  });
}]);

app.controller('ConfirmResetCtrl', ['$scope', 'MODAL', function($scope, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function (modal) {
    $scope.show = modal === MODAL.confirmReset;
  });
}]);

app.controller('SettingsCtrl', ['$scope', 'MODAL', function($scope, MODAL) {
  $scope.show = false;

  $scope.$watch('model.modal', function (modal) {
    $scope.show = modal === MODAL.settings;
  });

  $scope.$watch('model.settings.runAtSystemStart', function (runAtSystemStart) {
    $scope.runAtSystemStart = runAtSystemStart;
  });

  $scope.$watch('model.settings.autoReport', function (autoReport) {
    $scope.autoReport = autoReport;
  });

  $scope.$watch('model.settings.systemProxy', function (systemProxy) {
    $scope.systemProxy = systemProxy;
  });

  $scope.$watch('model.settings.proxyAllSites', function (proxyAllSites) {
    $scope.proxyAllSites = proxyAllSites;
  });
}]);

app.controller('ProxiedSitesCtrl', ['$scope', '$filter', 'SETTING', 'INTERACTION', 'INPUT_PAT', 'MODAL', 'Whitelist', function($scope, $filter, SETTING, INTERACTION, INPUT_PAT, MODAL, Whitelist) {
      var fltr = $filter('filter'),
      DOMAIN = INPUT_PAT.DOMAIN,
      IPV4 = INPUT_PAT.IPV4,
      nproxiedSitesMax = 1000,
      proxiedSites = [],
      proxiedSitesDirty = [];

  $scope.whitelist = [];

  Whitelist.get({ list: 'original'}).$promise.then(function(data) {
      $scope.originalList = data.Original;
      $scope.whitelist = data.Whitelist;
  });

  $scope.setFormScope = function(scope) {
      $scope.formScope = scope;
  };

  $scope.resetWhitelist = function(reset) {
    $scope.whitelist = $scope.originalList;
    $scope.input = $scope.whitelist;
    if (reset) {
        makeValid();
    } else {
        $scope.closeModal();
    }
  };

  $scope.show = false;

  $scope.$watch('searchText', function (searchText) {
    $scope.inputFiltered = (searchText ? fltr(proxiedSitesDirty, searchText) : proxiedSitesDirty).join('\n');
  });

  function makeValid() {
    $scope.errorLabelKey = '';
    $scope.errorCause = '';
    if ($scope.proxiedSitesForm && $scope.proxiedSitesForm.input) {
      $scope.proxiedSitesForm.input.$setValidity('generic', true);
    }
  }

  $scope.$watch('whitelist', function(proxiedSites_) {
    if (proxiedSites) {
      proxiedSites = normalizedLines(proxiedSites_);
      $scope.input = proxiedSites.join('\n');
      makeValid();
      proxiedSitesDirty = _.cloneDeep(proxiedSites);
    }
  }, true);

  $scope.$watch('model.nproxiedSitesMax', function(nproxiedSitesMax_) {
    nproxiedSitesMax = nproxiedSitesMax_;
    if ($scope.input)
      $scope.validate($scope.input);
  }, true);

  function normalizedLine (domainOrIP) {
    return angular.lowercase(domainOrIP.trim());
  }

  function normalizedLines (lines) {
    return _.map(lines, normalizedLine);
  }

  $scope.validate = function (value) {
    if (!value || !value.length) {
      $scope.errorLabelKey = 'ERROR_ONE_REQUIRED';
      $scope.errorCause = '';
      return false;
    }
    if (angular.isString(value)) value = value.split('\n');
    proxiedSitesDirty = [];
    var uniq = {};
    $scope.errorLabelKey = '';
    $scope.errorCause = '';
    for (var i=0, line=value[i], l=value.length, normline;
         i<l && !$scope.errorLabelKey;
         line=value[++i]) {
      normline = normalizedLine(line);
      if (!normline) continue;
      if (!(DOMAIN.test(normline) ||
            IPV4.test(normline))) {
        $scope.errorLabelKey = 'ERROR_INVALID_LINE';
        $scope.errorCause = line;
      } else if (!(normline in uniq)) {
        proxiedSitesDirty.push(normline);
        uniq[normline] = true;
      }
    }
    if (proxiedSitesDirty.length > nproxiedSitesMax) {
      $scope.errorLabelKey = 'ERROR_MAX_PROXIED_SITES_EXCEEDED';
      $scope.errorCause = '';
    }
    $scope.hasUpdate = !_.isEqual(proxiedSites, proxiedSitesDirty); 
    return !$scope.errorLabelKey;
  };

  $scope.handleContinue = function () {
    if ($scope.proxiedSitesForm.$invalid) {
      return $scope.interaction(INTERACTION.continue);
    }
    $scope.whitelist = proxiedSitesDirty;
    Whitelist.save({}, $scope.whitelist);
    $scope.closeModal();
  };
}]);

'use strict';

var directives = angular.module('app.directives', [])
  .directive('compileUnsafe', function ($compile) {
    return function (scope, element, attr) {
      scope.$watch(attr.compileUnsafe, function (val, oldVal) {
        if (!val || (val === oldVal && element[0].innerHTML)) return;
        element.html(val);
        $compile(element)(scope);
      });
    };
  })
  .directive('focusOn', function ($parse) {
    return function(scope, element, attr) {
      var val = $parse(attr['focusOn']);
      scope.$watch(val, function (val) {
        if (val) {
          element.focus();
        }
      });
    }
  });

// XXX https://github.com/angular/angular.js/issues/1050#issuecomment-9650293
angular.forEach(['x', 'y', 'cx', 'cy', 'd', 'fill', 'r'], function(name) {
  var ngName = 'ng' + name[0].toUpperCase() + name.slice(1);
  directives.directive(ngName, function() {
    return function(scope, element, attrs) {
      attrs.$observe(ngName, function(value) {
        attrs.$set(name, value); 
      })
    };
  });
});

'use strict';

var PI = Math.PI,
    TWO_PI = 2 * PI,
    abs = Math.abs,
    min = Math.min,
    max = Math.max,
    round = Math.round;

angular.module('app.vis', ['ngSanitize'])
  .directive('resizable', function ($window) {
    return function (scope, element) {
      function size() {
        var w = element[0].offsetWidth, h = element[0].offsetHeight;
        scope.projection.scale(max(w, h) / TWO_PI);
        scope.projection.translate([w >> 1, round(0.56*h)]);
        scope.$broadcast('mapResized', w, h);
      }

      size();

      angular.element($window).bind('resize', _.throttle(size, 500, {leading: false}));
    };
  })
  .directive('globe', function () {
    return function (scope, element) {
      var d = scope.path({type: 'Sphere'});
      element.attr('d', d);
    };
  })
  .directive('countries', function ($compile, $timeout, $window) {
    function ttTmpl(alpha2) {
      return '<div class="vis" style="min-width:150px; cursor:pointer;">'+
        '<div class="header">{{ "'+alpha2+'" | translate }}</div>'+
        '<div class="give-colored">{{ (model.countries.'+ alpha2+'.stats.gauges.userOnlineGiving == 1 ? "NUSERS_ONLINE_1" : "NUSERS_ONLINE_OTHER") | translate: \'{ value: model.countries.'+alpha2+'.stats.gauges.userOnlineGiving || 0 }\' }} {{ "GIVING_ACCESS" | translate }}</div>'+
        '<div class="get-colored">{{ (model.countries.'+alpha2+'.stats.gauges.userOnlineGetting == 1 ? "NUSERS_ONLINE_1" : "NUSERS_ONLINE_OTHER") | translate: \'{value: model.countries.'+alpha2+'.stats.gauges.userOnlineGetting || 0 }\' }} {{ "GETTING_ACCESS" | translate }}</div>'+
        '<div class="nusers {{ (!model.countries.'+alpha2+'.stats.gauges.userOnlineEver && !model.countries.'+alpha2+'.stats.counters.userOnlineEverOld) && \'gray\' || \'\' }}">'+
          '{{ (model.countries.'+alpha2+'.stats.gauges.userOnlineEver + model.countries.'+alpha2+'.stats.gauges.userOnlineEverOld) == 1 ? "NUSERS_EVER_1" : "NUSERS_EVER_OTHER" | translate: \'{ value: (model.countries.'+alpha2+'.stats.gauges.userOnlineEver + model.countries.'+alpha2+'.stats.gauges.userOnlineEverOld) }\' }}'+
        '</div>'+
        '<div class="stats">'+
          '<div class="bps{{ model.countries.'+alpha2+'.bps || 0 }}">'+
            '{{ model.countries.'+alpha2+'.bps || 0 | prettyBps }} {{ "TRANSFERRING_NOW" | translate }}'+
          '</div>'+
          '<div class="bytes{{ model.countries.'+alpha2+'.bytesEver || 0 }}">'+
            '{{model.countries.'+alpha2+'.stats.counters.bytesGiven | prettyBytes}} {{"GIVEN" | translate}}, ' +
            '{{model.countries.'+alpha2+'.stats.counters.bytesGotten | prettyBytes}} {{"GOTTEN" | translate}}' +
          '</div>'+
        '</div>'+
      '</div>';
    }

    return function (scope, element) {
      var maxNpeersOnline = 0,
          strokeOpacityScale = d3.scale.linear()
            .clamp(true).domain([0, 0]).range([0, 1]);

      // detect reset
      scope.$watch('model.setupComplete', function (newVal, oldVal) {
        if (oldVal && !newVal) {
          maxNpeersOnline = 0;
          strokeOpacityScale.domain([0, 0]);
        }
      }, true);

      var unwatch = scope.$watch('model.countries', function (countries) {
        if (!countries) return;
        d3.select(element[0]).selectAll('path').each(function (d) {
          var censors = !!getByPath(countries, '/'+d.alpha2+'/censors'); 
          if (censors) {
            d3.select(this).classed('censors', censors);
          }
        });
        unwatch();
      }, true);
      
      // Format connectivity ip for display
      scope.$watch('model.connectivity', function(connectivity) {
        if (connectivity) {
          if (model.dev) {
            connectivity.formattedIp = " (" + connectivity.ip + ")"; 
          }
        }
      });

      // Set up the world map once and only once
      d3.json('data/world.topojson', function (error, world) {
        if (error) throw error;
        //XXX need to do something like this to use latest topojson:
        //var f = topojson.feature(world, world.objects.countries).features;
        var countries = topojson.object(world, world.objects.countries).geometries;
        var country = d3.select(element[0]).selectAll('path').data(countries);
        country.enter()
          .append("g").append("path")
          .attr("title", function(d,i) { return d.name; })
          .each(function (d) {
            var el = d3.select(this);
            el.attr('d', scope.path).attr('stroke-opacity', 0);
            el.attr('class', 'COUNTRY_KNOWN');
            if (d.alpha2) {
              var $content = ttTmpl(d.alpha2);

              el.attr('class', d.alpha2 + " COUNTRY_KNOWN")
                .attr('tooltip-placement', 'mouse')
                .attr('tooltip-html-unsafe', $content);
                $compile(this)(scope);
            } else {
              el.attr('class', 'COUNTRY_UNKNOWN');
            }
          });
      });
      
      /*
       * Every time that our list of countries changes, do the following:
       * 
       * - Iterate over all countries to fine the maximum number of peers online
       *   (used for scaling opacity of countries)
       * - Update the opacity for every country based on our new scale
       * - For all countries whose number of online peers has changed, make the
       *   country flash on screen for half a second (this is done in bulk to
       *   all countries at once)
       */
      scope.$watch('model.countries', function (newCountries, oldCountries) {
        var changedCountriesSelector = "";
        var firstChangedCountry = true;
        var npeersOnlineByCountry = {};
        var countryCode, newCountry, oldCountry;
        var npeersOnline, oldNpeersOnline;
        var updated;
        var changedCountries;
        
        for (countryCode in newCountries) {
          newCountry = newCountries[countryCode];
          oldCountry = oldCountries ? oldCountries[countryCode] : null;
          npeersOnline = getByPath(newCountry, '/npeers/online/giveGet') || 0;
          oldNpeersOnline = oldCountry ? getByPath(oldCountry, '/npeers/online/giveGet') || 0 : 0;
          
          npeersOnlineByCountry[countryCode] = npeersOnline;
          
          // Remember the maxNpeersOnline
          if (npeersOnline > maxNpeersOnline) {
            maxNpeersOnline = npeersOnline;
          }
          
          // Country changed number of peers online, flag it
          if (npeersOnline !== oldNpeersOnline) {
            if (!firstChangedCountry) {
              changedCountriesSelector += ", ";
            }
            changedCountriesSelector += "." + countryCode;
            firstChangedCountry = false;
          }
        }
        
        // Update opacity for all known countries
        strokeOpacityScale.domain([0, maxNpeersOnline]);
        d3.select(element[0]).selectAll("path.COUNTRY_KNOWN").attr('stroke-opacity', function(d) {
          return strokeOpacityScale(npeersOnlineByCountry[d.alpha2] || 0);
        });
        
        // Flash update for changed countries
        if (changedCountriesSelector.length > 0) {
          changedCountries = d3.select(element[0]).selectAll(changedCountriesSelector); 
          changedCountries.classed("updating", true);
          $timeout(function () {
            changedCountries.classed('updating', false);
          }, 500);
        }
      }, true);
    };
  })
  .directive('peers', function ($compile, $filter) {
    var noNullIsland = $filter('noNullIsland');
    return function (scope, element) {
      // Template for our peer tooltips
      var peerTooltipTemplate = "<div class=vis> \
          <div class='{{peer.mode}} {{peer.type}}'> \
          <img class=picture src='{{peer.rosterEntry.picture || DEFAULT_AVATAR_URL}}'> \
          <div class=headers> \
            <div class=header>{{peer.rosterEntry.name}}</div> \
            <div class=email>{{peer.rosterEntry.email}}</div> \
            <div class='peerid ip'>{{peer.peerid}}{{peer.formattedIp}}</div> \
            <div class=type>{{peer.type && peer.mode && (((peer.type|upper)+(peer.mode|upper))|translate) || ''}}</div> \
          </div> \
          <div class=stats> \
            <div class=bps{{peer.bpsUpDn}}> \
              {{peer.bpsUp | prettyBps}} {{'UP' | translate}}, \
              {{peer.bpsDn | prettyBps}} {{'DN' | translate}} \
            </div> \
            <div class=bytes{{peer.bytesUpDn}}> \
              {{peer.bytesUp | prettyBytes}} {{'SENT' | translate}}, \
              {{peer.bytesDn | prettyBytes}} {{'RECEIVED' | translate}} \
            </div> \
            <div class=lastConnected> \
              {{!peer.connected && peer.lastConnected && 'LAST_CONNECTED' || '' | translate }} \
              <time>{{!peer.connected && (peer.lastConnected | date:'short') || ''}}</time> \
            </div> \
          </div> \
        </div> \
      </div>";
      
      // Scaling function for our connection opacity
      var connectionOpacityScale = d3.scale.linear()
        .clamp(true).domain([0, 0]).range([0, .9]);
      
      // Functions for calculating arc dimensions
      function getTotalLength(d) { return this.getTotalLength() || 0.0000001; }
      function getDashArray(d) { var l = this.getTotalLength(); return l+' '+l; }
      
      // Peers are uniquely identified by their peerid.
      function peerIdentifier(peer) {
        return peer.peerid;
      }
      
      /**
       * Return the CSS escaped version of the peer identifier
       */
      function escapedPeerIdentifier(peer) {
        return cssesc(peerIdentifier(peer), {isIdentifier: true});
      }
      
      var peersContainer = d3.select(element[0]);
      
      /*
       * Every time that our list of peers changes, we do the following:
       * 
       * For new peers only:
       * 
       * - Create an SVG group to contain everything related to that peer
       * - Create another SVG group to contain their dot/tooltip
       * - Add dots to show them on the map
       * - Add a hover target around the dot that activates a tooltip
       * - Bind those tooltips to the peer's data using Angular
       * - Add an arc connecting the user's dot to the peer
       * 
       * For all peers:
       * 
       * - Adjust the position of the peer dots
       * - Adjust the style of the peer dots based on whether or not the peer
       *   is currently connected
       * 
       * For all connecting arcs:
       * 
       * - Adjust the path of the arc based on the peer's current position
       * - If the peer has become connected, animate it to become visible
       * - If the peer has become disconnected, animate it to become hidden
       * - note: the animation is done in bulk for all connected/disconnected
       *   arcs
       * 
       * For disappeared peers:
       * 
       * - Remove their group, which removes everything associated with that
       *   peer
       * 
       */
      function renderPeers(peers, oldPeers) {
        if (!peers) return;

        // disregard peers on null island
        peers = noNullIsland(peers);
        oldPeers = noNullIsland(oldPeers);
      
        // Figure out our maxBps
        var maxBpsUpDn = 0;
        peers.forEach(function(peer) {
          if (maxBpsUpDn < peer.bpsUpDn)
            maxBpsUpDn = peer.bpsUpDn;
        });
        if (maxBpsUpDn !== connectionOpacityScale.domain()[1]) {
          connectionOpacityScale.domain([0, maxBpsUpDn]);
        }
        
        // Set up our d3 selections
        var allPeers = peersContainer.selectAll("g.peerGroup").data(peers, peerIdentifier);
        var newPeers = allPeers.enter().append("g").classed("peerGroup", true);
        var departedPeers = allPeers.exit();
        
        // Add groups for new peers, including tooltips
        var peerItems = newPeers.append("g")
          .attr("id", peerIdentifier)
          .classed("peer", true)
          .attr("tooltip-placement", "bottom")
          .attr("tooltip-html-unsafe", peerTooltipTemplate)
          .each(function(peer) {
            // Compile the tooltip target dom element to enable the tooltip-html-unsafe directive
            var childScope = scope.$new();
            childScope.peer = peer;
            // Format the ip for display
            if (model.dev && peer.ip) {
              peer.formattedIp = " (" + peer.ip + ")";
            }
            $compile(this)(childScope);
          });
        
        // Create points and hover areas for each peer
        peerItems.append("path").classed("peer", true);
        peerItems.append("path").classed("peer-hover-area", true);
        
        // Configure points and hover areas on each update
        allPeers.select("g.peer path.peer").attr("d", function(peer) {
            return scope.path({type: 'Point', coordinates: [peer.lon, peer.lat]})
        })
        .attr("filter", "url(#defaultBlur)")
        .attr("class", function(peer) {
          var result = "peer " + peer.mode + " " + peer.type;
          if (peer.connected) {
            result += " connected";
          }
          return result;
        });

        // Configure hover areas for all peers
        allPeers.select("g.peer path.peer-hover-area")
        .attr("d", function(peer) {
          return scope.path({type: 'Point', coordinates: [peer.lon, peer.lat]}, 6);
        });
        
        // Add arcs for new peers
        newPeers.append("path")
          .classed("connection", true)
          .attr("id", function(peer) { return "connection_to_" + peerIdentifier(peer); });
        
          // Set paths for arcs for all peers
          allPeers.select("path.connection")
          .attr("d", scope.pathConnection)
          .attr("stroke-opacity", function(peer) {
              return connectionOpacityScale(peer.bpsUpDn || 0);
          });

        // Animate connected/disconnected peers
        var newlyConnectedPeersSelector = "";
        var firstNewlyConnectedPeer = true;
        var newlyDisconnectedPeersSelector = "";
        var firstNewlyDisconnectedPeer = true;
        var oldPeersById = {};
        
        if (oldPeers) {
          oldPeers.forEach(function(oldPeer) {
            oldPeersById[peerIdentifier(oldPeer)] = oldPeer;
          });
        }
        
        // Find out which peers have had status changes
        peers.forEach(function(peer) {
          var peerId = peerIdentifier(peer);
          var escapedPeerId = escapedPeerIdentifier(peer);
          var oldPeer = oldPeersById[peerId];
          if (peer.connected) {
            if (!oldPeer || !oldPeer.connected) {
              if (!firstNewlyConnectedPeer) {
                newlyConnectedPeersSelector += ", ";
              }
              newlyConnectedPeersSelector += "#connection_to_" + escapedPeerId;
              firstNewlyConnectedPeer = false;
            }
          } else {
            if (!oldPeer || oldPeer.connected) {
              if (!firstNewlyDisconnectedPeer) {
                newlyDisconnectedPeersSelector += ", ";
              }
              newlyDisconnectedPeersSelector += "#connection_to_" + escapedPeerId;
              firstNewlyDisconnectedPeer = false;
            }
          }
        });
        
        if (newlyConnectedPeersSelector) {
          peersContainer.selectAll(newlyConnectedPeersSelector)
            .transition().duration(500)
              .each('start', function() {
                d3.select(this)
                  .attr('stroke-dashoffset', getTotalLength)
                  .attr('stroke-dasharray', getDashArray)
                  .classed('active', true);
              }).attr('stroke-dashoffset', 0);
        }
        
        if (newlyDisconnectedPeersSelector) {
          peersContainer.selectAll(newlyDisconnectedPeersSelector)
            .transition().duration(500)
            .each('start', function() {
              d3.select(this)
                .attr('stroke-dashoffset', 0)
                .attr('stroke-dasharray', getDashArray)
                .classed('active', false);
            }).attr('stroke-dashoffset', getTotalLength);
        }
        
        // Remove departed peers
        departedPeers.remove();

        scope.redraw(scope.zoom.translate(), scope.zoom.scale());
      }
      
      // Handle model changes
      scope.$watch('model.peers', renderPeers, true);
      
      // Handle resize
      scope.$on("mapResized", function() {

        d3.selectAll('#countries path').attr('d', scope.path);

        // Whenever the map resizes, we need to re-render the peers and arcs
        renderPeers(scope.model.peers, scope.model.peers);

        // The above render call left the arcs alone because there were no
        // changes.  We now need to do some additional maintenance on the arcs.
        
        // First clear the stroke-dashoffset and stroke-dasharray for all connections
        peersContainer.selectAll("path.connection")
          .attr("stroke-dashoffset", null)
          .attr("stroke-dasharray", null);
        
        // Then for active connections, update their values
        peersContainer.selectAll("path.connection.active")
          .attr("stroke-dashoffset", 0)
          .attr("stroke-dasharray", getDashArray);

        scope.redraw(scope.zoom.translate(), scope.zoom.scale());
      });
    };
  });

app.controller('VisCtrl', ['$scope', '$rootScope', '$compile', '$window', '$timeout', '$filter',  'modelSrvc', 'apiSrvc', function($scope, $rootScope, $compile, $window, $timeout, $filter, modelSrvc, apiSrvc) {

  var model = modelSrvc.model,
      isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0,
      width = document.getElementById('vis').offsetWidth,
      height = document.getElementById('vis').offsetHeight,
      projection = d3.geo.mercator(),
      path = d3.geo.path().projection(projection),
      DEFAULT_POINT_RADIUS = 3;

  $scope.projection = projection;

  $scope.once = false;

  /* the self dot isn't dynamically appended to the SVG
   * and we need a separate method to scale it when we zoom in/out
   */
  $scope.scaleSelf = function(factor) {
      var self = document.getElementById("self");
      var lat = self.getAttribute("lat");
      var lon = self.getAttribute("lon");
      if (self.getAttribute('d') != null &&
          lat != '' && lon != '') {
        var d = {type: 'Point', coordinates: [lon, 
                lat]};
        self.setAttribute('d', path(d));
      }
  };

  function scaleMapElements(scale) {
      var scaleFactor = (scale > 2) ? (5/scale) : DEFAULT_POINT_RADIUS;
      // stroke width is based off minimum threshold or scaled amount
      // according to user zoom-level
      var strokeWidth = Math.min(0.5, 1/scale);
      path.pointRadius(scaleFactor);
      $scope.scaleSelf(scaleFactor);
      d3.selectAll("#countries path").attr("stroke-width", 
        strokeWidth);
      d3.selectAll("path.connection").attr("stroke-width",
        strokeWidth);
      d3.select("#zoomCenter").classed('zoomedIn', scale != 1);

       /* scale peer radius as we zoom in */
      d3.selectAll("g.peer path.peer").attr("d", function(peer) {
          var d = {type: 'Point', coordinates: [peer.lon, peer.lat]};
          return path(d);
      });

      /* adjust gaussian blur by zoom level */
      if (scale > 2) {
          $scope.filterBlur.attr("stdDeviation", Math.min(1.0, 1/scale));
      } else {
          $scope.filterBlur.attr("stdDeviation", 0.8);
      }
      
  }
  
  // Constrain translate to prevent panning off map
  function constrainTranslate(translate, scale) {
    var vz = document.getElementById('vis'); 
    var w = vz.offsetWidth;
    var h = vz.offsetHeight;
    var topLeft = [0, 0];
    var bottomRight = [w * (scale - 1), h * (scale - 1)];  
    bottomRight[0] = -1 * bottomRight[0];
    bottomRight[1] = -1 * bottomRight[1];
    return [ Math.max(Math.min(translate[0], topLeft[0]), bottomRight[0]),
             Math.max(Math.min(translate[1], topLeft[1]), bottomRight[1]) ];
  }

  $scope.redraw = function(translate, scale) {

      translate = !translate ? d3.event.translate : translate;
      scale = !scale ? d3.event.scale : scale;

      translate = constrainTranslate(translate, scale);
      
      // Update the translate on the D3 zoom behavior to our constrained
      // value to keep them in sync.
      $scope.zoom.translate(translate);
      
      /* reset translation matrix */
      $scope.transMatrix = [scale, 0, 0, scale, 
        translate[0], translate[1]];

      d3.select("#zoomGroup").attr("transform", 
        "translate(" + translate.join(",") + ")scale(" + scale + ")");
    
      scaleMapElements(scale);

  };

  $scope.zoom = d3.behavior.zoom().scaleExtent([1,10]).on("zoom", 
                $scope.redraw);

   /* apply zoom behavior to container if we're running in webview since
    * it doesn't detect panning/zooming otherwise */
   d3.select(isSafari ? '#vis' : 'svg').call($scope.zoom);
   $scope.svg = d3.select('svg');
   $scope.filterBlur = $scope.svg.append("filter").attr("id", "defaultBlur").append("feGaussianBlur").attr("stdDeviation", "1");
  
  /* translation matrix on container zoom group element 
  *  used for combining scaling and translation transformations
  *  and for programmatically setting scale and zoom settings
  * */
  $scope.transMatrix = [1,0,0,1,0,0];

  $scope.centerZoom = function() {
    d3.select("#zoomGroup").attr("transform", "translate(0,0),scale(1)");
    $scope.zoom.translate([0,0]);
    $scope.zoom.scale([1]);
    $scope.redraw([0,0], 1);
  };

  $scope.adjustZoom = function(scale) {
      /* limit zoom range */
      if ((scale == 0.8 && $scope.zoom.scale() <= 1) ||
          (scale == 1.25 && $scope.zoom.scale() > 9)) {
        return;
      }

      var map = document.getElementById("map");
      var rect = map.getBoundingClientRect();
      var width = rect.width;
      var height = rect.height;

      /* multiply values in our translation matrix
       * by the scaling factor
       */
      for (var i=0; i< $scope.transMatrix.length; i++)
      {
          $scope.transMatrix[i] *= scale;
      }

      /* this preserves the position of the center
       * even after we've applied the scale factor */
      var translate = [$scope.transMatrix[4] + (1-scale)*width/2,
                       $scope.transMatrix[5] + (1-scale)*height/2];
      translate = constrainTranslate(translate, $scope.transMatrix[0]);
      $scope.transMatrix[4] = translate[0];
      $scope.transMatrix[5] = translate[1];
      
      var newMatrix = "matrix(" +  $scope.transMatrix.join(' ') + ")";
      d3.select("#zoomGroup").attr("transform", newMatrix);

      scaleMapElements($scope.transMatrix[0]);

      /* programmatically update our zoom translation vector and scale */
      $scope.zoom.translate([$scope.transMatrix[4], $scope.transMatrix[5]]);
      $scope.zoom.scale($scope.transMatrix[0]);
  };

  $scope.path = function (d, pointRadius) {
      path.pointRadius(pointRadius || DEFAULT_POINT_RADIUS);
      return path(d) || 'M0 0';
  };

  $scope.pathConnection = function (peer) {
    var MINIMUM_PEER_DISTANCE_FOR_NORMAL_ARCS = 30;
    
    var pSelf = projection([model.location.lon, model.location.lat]),
        pPeer = projection([peer.lon, peer.lat]),
        xS = pSelf[0], yS = pSelf[1], xP = pPeer[0], yP = pPeer[1];
    
    var distanceBetweenPeers = Math.sqrt(Math.pow(xS - xP, 2) + Math.pow(yS - yP, 2));
    var xL, xR, yL, yR;
    
    if (distanceBetweenPeers < MINIMUM_PEER_DISTANCE_FOR_NORMAL_ARCS) {
      // Peer and self are very close, draw a loopy arc
      // Make sure that the arc's line doesn't cross itself by ordering the
      // peers from left to right
      if (xS < xP) {
        xL = xS;
        yL = yS;
        xR = xP;
        yR = yP;
      } else {
        xL = xP;
        yL = yP;
        xR = xS;
        yR = yS;
      }
      var xC1 = Math.min(xL, xR) - MINIMUM_PEER_DISTANCE_FOR_NORMAL_ARCS * 2 / 3;
      var xC2 = Math.max(xL, xR) + MINIMUM_PEER_DISTANCE_FOR_NORMAL_ARCS * 2 / 3;
      var yC = Math.max(yL, yR) + MINIMUM_PEER_DISTANCE_FOR_NORMAL_ARCS;
      return 'M'+xL+','+yL+' C '+xC1+','+yC+' '+xC2+','+yC+' '+xR+','+yR;
    } else {
      // Peer and self are at different positions, draw arc between them
      var controlPoint = [abs(xS+xP)/2, min(yS, yP) - abs(xP-xS)*0.3],
          xC = controlPoint[0], yC = controlPoint[1];
      return $scope.inGiveMode ?
          'M'+xP+','+yP+' Q '+xC+','+yC+' '+xS+','+yS :
          'M'+xS+','+yS+' Q '+xC+','+yC+' '+xP+','+yP;
    }
  };
}]);
