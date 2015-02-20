class MetaController {
  constructor(PageMetadata) {
    this.meta = PageMetadata;
  }
}
MetaController.$inject = ['PageMetadata'];

export default MetaController;