(function($, angular) {

  //var DB_BASE_URL = 'http://192.168.1.200:8123/desmond';
  var DB_BASE_URL = 'http://192.168.1.200:8123/desmond_dev';

  var Desmond = angular.module('Desmond', [
    'ngSanitize', 'restangular', 'angular.layout', 'angularFileUpload', 'nl2br',
    'ui.utils', 'ui.bootstrap',
    'Desmond.Rules', 'Desmond.Reader', 'Desmond.Model', 'Desmond.Component'
  ]);

  Desmond.filter('total', function() {
    return function(movements) {
      return _.reduce(movements, function(total, movement) {
        return total + movement.amount;
      }, 0.0);
    }
  });

  // leverage angular $parse to replace the too simplistic templating engine of Charts.js
  Desmond.run(['$parse', function($parse) {
    Chart.helpers.template = function(tpl, data) {
      var getter = $parse(tpl);
      return getter(data);
    };
  }]);

  Desmond.config(['RestangularProvider', function(RestangularProvider) {
    RestangularProvider.setBaseUrl(DB_BASE_URL);
    RestangularProvider.setRestangularFields({id: '_id'});

    // extract data from the list response of restheart
    RestangularProvider.addResponseInterceptor(function(data, operation, what, url, response, deferred) {
      if (operation === "getList") {
        if (data['_embedded'] && data['_embedded']['rh:doc']) {
          return data['_embedded']['rh:doc'];
        } else {
          return [];
        }
      } else if (operation === "post") {
        // sometimes data is an empty string, restheart error?
        if (!_.isObject(data)) {
          data = {};
        }
        if (response.status === 201) {
          var urlChunks = response.headers().location.split('/');
          console.log(urlChunks[urlChunks.length - 1]);
          data._id = urlChunks[urlChunks.length - 1];
        } else {
          console.error(response);
        }
        return data;
      } else {
        return data;
      }
    });
  }]);

  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  })

})(window.jQuery, window.angular);