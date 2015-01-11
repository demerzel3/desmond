(function($, angular) {

  var Rules = angular.module('Desmond.Rules', ['Desmond.Service', 'Desmond.Model']);
  Rules.run(['RulesContainer', 'CategoriesRepository', 'AccountsRepository', 'Movement', function(RulesContainer, CategoriesRepository, AccountsRepository, Movement) {

    RulesContainer.rule('F24', function(movement) {
      if (movement.description.indexOf('ADDEBITO DELEGA F24') > -1) {
        movement.category = CategoriesRepository.find('imposte');
        return true;
      }
    });

    RulesContainer.rule('Bollo', function(movement) {
      if (movement.description.indexOf('IMPOSTA DI BOLLO') > -1) {
        movement.category = CategoriesRepository.find('imposte');
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
        movement.category = CategoriesRepository.find('commissioni');
        return true;
      }
    });

    RulesContainer.rule('Interessi', function(movement) {
      if (movement.direction === Movement.DIRECTION_IN && (
        movement.description.indexOf('COMPETENZE LIQUIDAZIONE') > -1
        || movement.description.indexOf('COMPETENZE BONUS') > -1
        || movement.description.indexOf('COMPETENZE AL CONTO') > -1
        || movement.description.indexOf('COMPETENZE SU C/C') > -1)) {
        //movement.category = CategoriesRepository.find('investimenti');
        movement.source = AccountsRepository.findByName('Interessi');
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
          movement.category = CategoriesRepository.find('supermercato');
          return true;
        }
      }
    });

    RulesContainer.rule('Carburante', function(movement) {
      if (movement.description.indexOf('PAGOBANCOMAT') > -1
        || movement.description.indexOf('ACQUISTO CARTA DI CREDITO') > -1) {
        if (movement.description.indexOf('ESSO') > -1
          || movement.description.indexOf('Q8') > -1) {
          movement.category = CategoriesRepository.find('carburante');
          return true;
        }
      }
    });

    RulesContainer.rule('Voli', function(movement) {
      if (movement.description.indexOf('EASYJET') > -1) {
        movement.category = CategoriesRepository.find('viaggi');
        return true;
      }
    });

    RulesContainer.rule('Ristoranti', function(movement) {
      if (movement.description.indexOf('RISTORAN') > -1
        || movement.description.indexOf('OSTERIA') > -1) {
        movement.category = CategoriesRepository.find('tempo_libero');
        return true;
      }
    });

    RulesContainer.rule('Cinema', function(movement) {
      if (movement.description.indexOf('SKYLINE') > -1
        || movement.description.indexOf('UCI MILANO') > -1) {
        movement.category = CategoriesRepository.find('tempo_libero');
        return true;
      }
    });

    RulesContainer.rule('Farmacie', function(movement) {
      if (movement.description.indexOf('FARMACIA') > -1) {
        movement.category = CategoriesRepository.find('farmaci');
        return true;
      }
    });

    RulesContainer.rule('Abbigliamento', function(movement) {
      if (movement.description.indexOf('GEOX') > -1) {
        movement.category = CategoriesRepository.find('abbigliamento');
        return true;
      }
    });

    RulesContainer.rule('Mutuo', function(movement) {
      if (movement.description.indexOf('RIMBORSO FINANZIAMENTO N.') > -1) {
        movement.category = CategoriesRepository.find('mutuo');
        return true;
      }
    });

    RulesContainer.rule('Mutuo', function(movement) {
      if (movement.description.indexOf('ADDEBITO SEPA DD') > -1) {
        movement.category = CategoriesRepository.find('bollette');
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


    RulesContainer.rule('Trasferimenti', function(movement) {
      if (movement.account.bank === 'bnl') {
        if (movement.description.indexOf('VERSAMENTO DI CONTANTE O ASSIMILATI') > -1) {
          movement.source = AccountsRepository.moneyAccount;
          return true;
        }
        if (movement.description.indexOf('BONIFICO A VOSTRO FAVORE') > -1) {
          if (movement.description.indexOf('DA DE CARLO BARBARA, GENTA GABRIELE') > -1) {
            movement.source = AccountsRepository.findByName('IWBank');
          } else if (movement.description.indexOf('GENTA GABRIELE') > -1) {
            movement.source = AccountsRepository.findByName('Gabriele');
          } else if (movement.description.indexOf('DE CARLO BARBARA') > -1) {
            movement.source = AccountsRepository.findByName('Barbara');
          }
          return true;
        }
      } else if (movement.account.bank === 'iwbank') {
        if (movement.description.indexOf('VERSAMENTO C/O POSTE') > -1) {
          movement.source = AccountsRepository.moneyAccount;
          return true;
        }
        if (movement.description.indexOf('BONIFICO A VS. FAVORE') > -1
          || movement.description.indexOf('BONIFICO A VOSTRO FAVORE') > -1
          || movement.description.indexOf('PRIMO BONIFICO') > -1) {
          if (movement.description.toUpperCase().indexOf('GENTA GABRIELE') > -1
            || movement.description.toUpperCase().indexOf('NPCREW S.R.L.') > -1) {
            movement.source = AccountsRepository.findByName('Gabriele');
          } else if (movement.description.toUpperCase().indexOf('DE CARLO BARBARA') > -1) {
            movement.source = AccountsRepository.findByName('Barbara');
          } else if (movement.description.toUpperCase().indexOf('MARICA') > -1) {
            movement.source = AccountsRepository.findByName('Marica');
          } else if (movement.description.toUpperCase().indexOf('GIUSEPPE DE CARLO') > -1
            || movement.description.toUpperCase().indexOf('DE CARLO GIUSEPPE') > -1) {
            movement.source = AccountsRepository.findByName('Pino');
          } else if (movement.description.toUpperCase().indexOf('GENTA LUCIANO') > -1) {
            movement.source = AccountsRepository.findByName('Luciano');
          }
          return true;
        }
        if (movement.description.indexOf('GIROCONTO') > -1
          || movement.description.indexOf('GIRO COMPETENZE') > -1) {
          if (movement.description.indexOf('CAPITALE A SCADENZA') > -1
            || movement.description.indexOf('TRASFERIMENTO IN') > -1
            || movement.description.indexOf('TRASFERIMENTO OUT')) {
            var iwPower = AccountsRepository.findByName('IWPower');
            if (Movement.DIRECTION_IN === movement.direction) {
              movement.source = iwPower;
            } else {
              movement.destination = iwPower;
            }
          }
          return true;
        }
      } else if (movement.account.bank === 'iwpower') {
        //console.log(movement.description);
        if (movement.description.indexOf('GIROCONTO') > -1
          || movement.description.indexOf('GIRO COMPETENZE AL CONTO') > -1) {
          var iwBank = AccountsRepository.findByName('IWBank');
          if (Movement.DIRECTION_IN === movement.direction) {
            movement.source = iwBank;
          } else {
            movement.destination = iwBank;
          }
          return true;
        }
      }
    });


  }]);

})(window.jQuery, window.angular);