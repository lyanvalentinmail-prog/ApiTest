export default {
  name: 'models',
  category: 'Modelos AI/ML API',
  usage: '[búsqueda | all | image]',
  description: 'Consulta el catálogo vivo de todos los modelos.',
  async execute(context, services) {
    return services.runModels(context, context.args);
  },
};
