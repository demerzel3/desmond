(function($, angular) {

  var RuntimeConfiguration = function($q, $http) {
    this.$http = $http;

    this._loadingDeferred = $q.defer();
  };
  RuntimeConfiguration.$inject = ['$q', '$http'];

  /**
   * @returns {Promise<Object>}
   */
  RuntimeConfiguration.prototype.get = function() {
    return this._loadingDeferred.promise;
  };

  /**
   * Triggers loading of configuration from external JSON file based on the environment to be loaded.
   * Should be called only once per execution.
   * @param environment
   */
  RuntimeConfiguration.prototype.load = function(environment) {
    if (environment && environment.match(/[a-z]+/)) {
      environment = '.' + environment;
    } else {
      environment = '';
    }
    var me = this;
    var err = new Error('Invalid configuration file, JSON expected. Check /config' + environment + '.json');
    this.$http.get('/config' + environment + '.json').success(function(result) {
      if (!_.isObject(result)) {
        throw err;
      }
      me._loadingDeferred.resolve(result);
    }).error(function(e) {
      err.details = e;
      throw err;
    });
  };

  var Configuration = angular.module('Desmond.Configuration', []);
  Configuration.service('RuntimeConfiguration', RuntimeConfiguration);

})(window.jQuery, window.angular);