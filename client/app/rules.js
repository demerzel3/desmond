(function($, angular) {

  var Rules = angular.module('Desmond.Rules', ['Desmond.Service', 'Desmond.Model']);
  Rules.run(['RulesContainer', 'CategoriesRepository', function(RulesContainer, CategoriesRepository) {

    RulesContainer.rule('F24', function(movement) {
      if (movement.description.indexOf('ADDEBITO DELEGA F24') > -1) {
        movement.category = CategoriesRepository.all['imposte'];
      }
    });

    RulesContainer.rule('Bollo', function(movement) {
      if (movement.description.indexOf('IMPOSTA DI BOLLO') > -1) {
        movement.category = CategoriesRepository.all['imposte'];
      }
    });

    RulesContainer.rule('Interessi', function(movement) {
      if (movement.description.indexOf('GIRO COMPETENZE') > -1) {
        movement.category = CategoriesRepository.all['investimenti'];
      }
    });

    RulesContainer.rule('Supermercati e Alimentari', function(movement) {
      if (movement.description.indexOf('PAGOBANCOMAT') > -1) {
        if (movement.description.indexOf('ESSELUN') > -1
          || movement.description.indexOf('IPERCOO') > -1
          || movement.description.indexOf('CONAD') > -1
          || movement.description.indexOf('TIGROS') > -1
          || movement.description.indexOf('BOFROST') > -1
          || movement.description.indexOf('LIDL') > -1) {
          movement.category = CategoriesRepository.all['supermercato'];
        }
      }
    });

    RulesContainer.rule('Carburante', function(movement) {
      if (movement.description.indexOf('PAGOBANCOMAT') > -1) {
        if (movement.description.indexOf('ESSO') > -1
          || movement.description.indexOf('Q8') > -1) {
          movement.category = CategoriesRepository.all['carburante'];
        }
      }
    });

    RulesContainer.rule('Carta di credito', function(movement) {
      if (movement.description.indexOf('ADDEBITO ACQUISTI EFFETTUATI CON CARTA DI CREDITO') > -1) {
        // this movement is replaceable with more detailed ones, loadable from another file
        movement.replaceable = {
          info: 'Trascina qui l\'estratto conto della carta di credito per caricare i dettagli',
          type: 'application/pdf',
          handler: ''
        };
      }
    });


  }]);

})(window.jQuery, window.angular);