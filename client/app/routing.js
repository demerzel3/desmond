(function(Desmond) {

  Desmond.config(['$stateProvider', '$locationProvider', '$urlRouterProvider',
    function ($stateProvider, $locationProvider, $urlRouterProvider) {
      $locationProvider.html5Mode(true);
      $urlRouterProvider.otherwise("/");

      $stateProvider
        .state('home', {
          url: '/',
          templateUrl: 'views/home.html',
          controller: 'HomeController',
          controllerAs: 'ctrl'
        })
        .state('month', {
          url: '/months/{month}?cat',
          templateUrl: 'views/month.html',
          controller: 'MonthController',
          controllerAs: 'ctrl'
        })
      ;
    }
  ]);

})(window.angular.module('Desmond'));