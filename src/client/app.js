import {Component, View, bootstrap} from '../angular2/angular2';
import './configuration';
import './service';
import './model';
import './reader';
import './rules';
import './component';

import HomeController from './controller/home_controller';
import MetaController from './controller/meta_controller';
import DropController from './controller/drop_controller';
import SidebarController from './controller/sidebar_controller';
import EditModalController from './controller/edit_modal_controller';
import ImportModalController from './controller/import_modal_controller';
import MonthController from './controller/month_controller';
import UnassignedController from './controller/unassigned_controller';

var Desmond = angular.module('Desmond', [
  'ngSanitize',
  'restangular', 'angular.layout', 'angularFileUpload', 'nl2br',
  'monospaced.elastic',
  'ui.router', 'ui.utils', 'ui.bootstrap',
  'Desmond.Configuration', 'Desmond.Service', 'Desmond.Model', 'Desmond.Rules', 'Desmond.Reader', 'Desmond.Component'
]);

Desmond.filter('total', () => {
  return (movements) => {
    return movements.reduce((total, movement) => total + movement.amount, 0.0);
  }
});

// leverage angular $parse to replace the too simplistic templating engine of Charts.js
Desmond.run(['$parse', function($parse) {
  Chart.helpers.template = function(tpl, data) {
    var getter = $parse(tpl);
    return getter(data);
  };
}]);

Desmond.run(['Restangular', 'RuntimeConfiguration', (Restangular, RuntimeConfiguration) => {

  RuntimeConfiguration.get().then((config) => {
    Restangular.setBaseUrl(config.database.url);
  });
  Restangular.setRestangularFields({id: '_id'});

  Restangular.addFullRequestInterceptor((element, operation, what, url, headers, params) => {
    if ('put' === operation) {
      // remove all underscored fields from the element
      element = angular.copy(element);
      headers['If-Match'] = element._etag;
      Object.keys(element).forEach((key) => {
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
  Restangular.addResponseInterceptor((data, operation, what, url, response, deferred) => {
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
        //console.log(urlChunks[urlChunks.length - 1]);
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

Desmond.controller('HomeController', HomeController);
Desmond.controller('MetaController', MetaController);
Desmond.controller('DropController', DropController);
Desmond.controller('SidebarController', SidebarController);
Desmond.controller('EditModalController', EditModalController);
Desmond.controller('ImportModalController', ImportModalController);
Desmond.controller('MonthController', MonthController);
Desmond.controller('UnassignedController', UnassignedController);

export default Desmond;

class TestComponent {
  constructor() {
    this.n = 0;
  }

  test() {
    console.log('Angular2 is running and working great.. WOW!!');
    this.n++;
  }
}
TestComponent.annotations = [
  new Component({selector: 'testing'}),
  new View({template: '<h1><a class="btn btn-default" (click)="test()">Test {{n}}</a></h1>'})
];
bootstrap(TestComponent);