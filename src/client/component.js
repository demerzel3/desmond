import DesmondMovementsTableFactory from 'component/movements_table.js';

var Component = angular.module('Desmond.Component', []);

Component.directive('desmondMovementsTable', DesmondMovementsTableFactory);

Component.directive('colorFromImage', function() {
  var colorThief = new ColorThief();

  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var img = element.find('img').andSelf().filter('img');
      if (img.length === 0) {
        return;
      }

      img.on('load', function() {
        var color = colorThief.getPalette(img[0], 3)[0];
        var styleName = attrs.colorFromImage || 'color';
        var style = {};
        style[styleName] = 'rgb('+color[0]+','+color[1]+','+color[2]+')';
        element.css(style);
      });
    }
  };
});



Component.directive('dragOverScreen', ['$timeout', function($timeout) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var leaveTimeout = null;
      var enterCount = 0;
      var leaveCount = 0;
      var dragElement = null;

      document.addEventListener('dragover', function(event) {
        // allow drop!
        event.preventDefault();
      }, false);

      document.addEventListener('dragenter', function(event) {
        dragElement = event.target;
        if (leaveTimeout) {
          $timeout.cancel(leaveTimeout);
          leaveTimeout = null;
        }
        element.addClass('dragover');
        enterCount++;
      }, false);

      document.addEventListener('dragleave', function(event) {
        if (event.target === dragElement) {
          dragElement = null;
          leaveTimeout = $timeout(function () {
            element.removeClass('dragover');
            leaveTimeout = null;
          }, 500);
          leaveCount++;
        }
      }, false);

      document.addEventListener('drop', function(event) {
        element.removeClass('dragover');
        event.preventDefault();
      }, false);
    }
  }
}]);