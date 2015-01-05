(function($, angular) {

  var Rules = angular.module('Desmond.Rules', ['Desmond.Service', 'Desmond.Model']);
  Rules.run(['RulesContainer', 'CategoriesRepository', 'AccountsRepository', function(RulesContainer, CategoriesRepository, AccountsRepository) {

    RulesContainer.rule('F24', function(movement) {
      if (movement.description.indexOf('ADDEBITO DELEGA F24') > -1) {
        movement.category = CategoriesRepository.all['imposte'];
        return true;
      }
    });

    RulesContainer.rule('Bollo', function(movement) {
      if (movement.description.indexOf('IMPOSTA DI BOLLO') > -1) {
        movement.category = CategoriesRepository.all['imposte'];
        return true;
      }
    });

    RulesContainer.rule('Commissioni', function(movement) {
      if (movement.description.indexOf('COMMISSIONI OPERAZIONI') > -1
        || movement.description.indexOf('SPESE DI APERTURA') > -1
        || movement.description.indexOf('CANONE CONTO') > -1
        || movement.description.indexOf('COSTO CARNET ASSEGNI') > -1
        || movement.description.indexOf('SPESE DI REGISTRAZIONE') > -1
        || movement.description.indexOf('SPESE INVIO DOCUMENTO') > -1
        || movement.description.indexOf('SPESE INVIO E/C') > -1
        || movement.description.indexOf('RECUPERO SPESE') > -1) {
        movement.category = CategoriesRepository.all['commissioni'];
        return true;
      }
    });

    RulesContainer.rule('Interessi', function(movement) {
      if (movement.description.indexOf('GIRO COMPETENZE') > -1
        || movement.description.indexOf('COMPETENZE SU C/C') > -1) {
        movement.category = CategoriesRepository.all['investimenti'];
        return true;
      }
    });

    RulesContainer.rule('Supermercati e Alimentari', function(movement) {
      if (movement.description.indexOf('PAGOBANCOMAT') > -1
        || movement.description.indexOf('ACQUISTO CARTA DI CREDITO') > -1) {
        if (movement.description.indexOf('ESSELUN') > -1
          || movement.description.indexOf('IPERCOO') > -1
          || movement.description.indexOf('CONAD') > -1
          || movement.description.indexOf('TIGROS') > -1
          || movement.description.indexOf('BOFROST') > -1
          || movement.description.indexOf('CARREFOUR') > -1
          || movement.description.indexOf('LIDL') > -1) {
          movement.category = CategoriesRepository.all['supermercato'];
          return true;
        }
      }
    });

    RulesContainer.rule('Carburante', function(movement) {
      if (movement.description.indexOf('PAGOBANCOMAT') > -1
        || movement.description.indexOf('ACQUISTO CARTA DI CREDITO') > -1) {
        if (movement.description.indexOf('ESSO') > -1
          || movement.description.indexOf('Q8') > -1) {
          movement.category = CategoriesRepository.all['carburante'];
          return true;
        }
      }
    });

    RulesContainer.rule('Voli', function(movement) {
      if (movement.description.indexOf('EASYJET') > -1) {
        movement.category = CategoriesRepository.all['viaggi'];
        return true;
      }
    });

    RulesContainer.rule('Ristoranti', function(movement) {
      if (movement.description.indexOf('RISTORAN') > -1
        || movement.description.indexOf('OSTERIA') > -1) {
        movement.category = CategoriesRepository.all['tempo_libero'];
        return true;
      }
    });

    RulesContainer.rule('Cinema', function(movement) {
      if (movement.description.indexOf('SKYLINE') > -1
        || movement.description.indexOf('UCI MILANO') > -1) {
        movement.category = CategoriesRepository.all['tempo_libero'];
        return true;
      }
    });

    RulesContainer.rule('Farmacie', function(movement) {
      if (movement.description.indexOf('FARMACIA') > -1) {
        movement.category = CategoriesRepository.all['farmaci'];
        return true;
      }
    });

    RulesContainer.rule('Abbigliamento', function(movement) {
      if (movement.description.indexOf('GEOX') > -1) {
        movement.category = CategoriesRepository.all['abbigliamento'];
        return true;
      }
    });

    RulesContainer.rule('Mutuo', function(movement) {
      if (movement.description.indexOf('RIMBORSO FINANZIAMENTO N.') > -1) {
        movement.category = CategoriesRepository.all['mutuo'];
        return true;
      }
    });

    RulesContainer.rule('Mutuo', function(movement) {
      if (movement.description.indexOf('ADDEBITO SEPA DD') > -1) {
        movement.category = CategoriesRepository.all['bollette'];
        return true;
      }
    });

    RulesContainer.rule('Carta di credito', function(movement) {
      if (movement.description.indexOf('ADDEBITO ACQUISTI EFFETTUATI CON CARTA DI CREDITO') > -1) {
        // this movement is replaceable with more detailed ones, loadable from another file
        movement.replaceable = {
          info: 'Trascina qui l\'estratto conto della carta di credito per caricare i dettagli',
          accept: 'application/pdf',
          reader: 'IWBankEstrattoContoCartaReader',
          checker: function(movement, document) {
            if (!movement.executionDate.isSame(document.date, 'day')
              || movement.amount != document.total) {
              console.log(movement.executionDate.format(), document.date.format());
              console.log(movement.amount, document.total);
              throw new Error('Il file non corrisponde alla riga su cui l\'hai trascinato, verifica che le date e gli importi corrispondano e riprova.');
            }
          }
        };
        return true;
      }
    });


  }]);

})(window.jQuery, window.angular);