export default class MetaController {
  constructor(PageMetadata) {
    this.meta = PageMetadata;
  }
}
MetaController.$inject = ['PageMetadata'];