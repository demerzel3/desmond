class RuntimeConfiguration {

  constructor($q, $http) {
    this.$http = $http;

    this._loadingDeferred = $q.defer();
  }

  /**
   * @returns {Promise<Object>}
   */
  get() {
    return this._loadingDeferred.promise;
  }

  /**
   * Triggers loading of configuration from external JSON file based on the environment to be loaded.
   * Should be called only once per execution.
   * @param environment
   */
  load(environment) {
    if (environment && environment.match(/[a-z]+/)) {
      environment = '.' + environment;
    } else {
      environment = '';
    }
    var err = new Error('Invalid configuration file, JSON expected. Check /config' + environment + '.json');
    this.$http.get('/config' + environment + '.json').success((result) => {
      if (!_.isObject(result)) {
        throw err;
      }
      this._loadingDeferred.resolve(result);
    }).error((e) => {
      err.details = e;
      throw err;
    });
  }

}
RuntimeConfiguration.$inject = ['$q', '$http'];

var Configuration = angular.module('Desmond.Configuration', []);
Configuration.service('RuntimeConfiguration', RuntimeConfiguration);

