export default {
  name: 'model',
  category: 'Modelos del proveedor',
  usage: '[id]',
  description: 'Muestra o cambia el modelo de texto.',
  async execute(context, services) {
    return services.runModel(context, context.args);
  },
};
