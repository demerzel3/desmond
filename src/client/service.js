import Statistics from 'service/statistics.js';

/**
 * @param name
 * @param callable
 * @param [priority]
 * @constructor
 */
class Rule {
  constructor(name, callable, priority = 0) {
    this.name = name;
    this.callable = callable;
    this.priority = priority;
  }
}



class RulesContainer {
  constructor() {
    this.rules = [];
  }

  rule(name, callable, priority) {
    var rule = new Rule(name, callable, priority);
    this.rules.push(rule);
    this.rules = _.sortBy(this.rules, 'priority');
  }

  /**
   * Apply all the rules to a movement, stopping at the first that applies successfully.
   *
   * @param movement
   */
  applyAll(movement) {
    for (let rule of this.rules) {
      if (rule.callable.apply(movement, [movement])) {
        movement._appliedRule = rule.name;
        break;
      }
    }
  }
}



class PageMetadata {
  constructor() {
    this.title = "Desmond";
  }
}



class FileHasher {
  constructor($q) {
    this.$q = $q;
  }

  /**
   * Adds an hash filed to the file and returns it (promise).
   *
   * @param file
   * @returns {Promise<File>}
   */
  hashFile(file) {
    var readData = this.$q(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsBinaryString(file);
    });

    return readData.then(function(binaryData) {
      file.hash = SparkMD5.hashBinary(binaryData);
      return file;
    });
  }
}
FileHasher.$inject = ['$q'];



var Service = angular.module('Desmond.Service', []);
Service.service('RulesContainer', RulesContainer);
Service.service('PageMetadata', PageMetadata);
Service.service('FileHasher', FileHasher);
Service.service('Statistics', Statistics);
