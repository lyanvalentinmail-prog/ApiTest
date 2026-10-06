export default {
  name: 'imagemodel',
  category: 'Modelos AI/ML API',
  usage: '[id]',
  description: 'Muestra o cambia el modelo de imagen. Ⓟ',
  async execute(context, services) {
    return services.runImageModel(context, context.args);
  },
};
