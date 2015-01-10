(function($, angular) {

  var Config = {
    dev: {
      DB_BASE_URL: 'http://192.168.1.200:8123/desmond_dev'
    },
    prod: {
      DB_BASE_URL: 'http://192.168.1.200:8123/desmond'
    }
  };

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

  Desmond.config(['$locationProvider', function($locationProvider) {
    $locationProvider.html5Mode(true);
  }]);

  Desmond.run(['Restangular', '$location', 'PageMetadata', function(Restangular, $location, PageMetadata) {
    var environment = $location.search()['dev'] ? 'dev' : 'prod';

    if (environment !== 'prod') {
      // change page title
      PageMetadata.title = '['+environment+'] '+PageMetadata.title;
    }

    Restangular.setBaseUrl(Config[environment].DB_BASE_URL);
    Restangular.setRestangularFields({id: '_id'});

    Restangular.addFullRequestInterceptor(function(element, operation, what, url, headers, params) {
      if ('put' === operation) {
        // remove all underscored fields from the element
        element = angular.copy(element);
        headers['If-Match'] = element._etag;
        _.forEach(element, function(value, key) {
          if (key[0] === '_') {
            delete element[key];
          }
        });
        return {element: element, headers: headers};
      } else {
        return {element: element};
      }
    });

    /**
     * Handle restheart peculiar responses.
     */
    Restangular.addResponseInterceptor(function(data, operation, what, url, response, deferred) {
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