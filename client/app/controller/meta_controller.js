(function($, angular) {

  var MetaController = function(PageMetadata) {
    this.meta = PageMetadata;
  };
  MetaController.$inject = ['PageMetadata'];

  angular.module('Desmond').controller('MetaController', MetaController);

})(window.jQuery, window.angular);