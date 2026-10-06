export default {
  name: 'imagemodel',
  category: 'Modelos del proveedor',
  usage: '[id]',
  description: 'Muestra o cambia el modelo de imagen. Ⓟ',
  async execute(context, services) {
    return services.runImageModel(context, context.args);
  },
};
