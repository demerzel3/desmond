import Desmond from 'app.js';

Desmond.config(['$stateProvider', '$locationProvider', '$urlRouterProvider',
  function ($stateProvider, $locationProvider, $urlRouterProvider) {
    $locationProvider.html5Mode(true);
    $urlRouterProvider.otherwise("/app/");

    $stateProvider
      .state('env', {
        url: '/{env:dev|app}',
        controller: ['$stateParams', 'PageMetadata', 'RuntimeConfiguration', function($stateParams, PageMetadata, RuntimeConfiguration) {
          // load runtime configuration, bootstraps other parts of the application
          var env = $stateParams.env === 'app' ? undefined : $stateParams.env;
          if (env) {
            PageMetadata.title = '[' + env + '] ' + PageMetadata.title;
          }
          RuntimeConfiguration.load(env);
        }],
        template: '<ui-view vbox grow="1"></ui-view>'
      })
      .state('env.home', {
        url: '/',
        templateUrl: 'views/home.html',
        controller: 'HomeController',
        controllerAs: 'ctrl'
      })
      .state('env.month', {
        url: '/months/{month}?cat',
        templateUrl: 'views/month.html',
        controller: 'MonthController',
        controllerAs: 'ctrl'
      })
    ;
  }
]);
