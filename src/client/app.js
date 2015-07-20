import 'configuration.js';
import 'service.js';
import 'model.js';
import 'reader.js';
import 'rules.js';
import 'component.js';

import HomeController from 'controller/home_controller.js';
import MetaController from 'controller/meta_controller.js';
import DropController from 'controller/drop_controller.js';
import SidebarController from 'controller/sidebar_controller.js';
import EditModalController from 'controller/edit_modal_controller.js';
import ImportModalController from 'controller/import_modal_controller.js';
import MonthController from 'controller/month_controller.js';
import UnassignedController from 'controller/unassigned_controller.js';

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