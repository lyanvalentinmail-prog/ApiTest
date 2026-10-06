export default {
  name: 'imagine',
  category: 'IA de imagen',
  usage: '<prompt>',
  description: 'Genera una imagen con el modelo seleccionado. Ⓟ',
  async execute(context, services) {
    return services.runImagine(context, context.args);
  },
};
