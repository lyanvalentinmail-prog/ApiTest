export default {
  name: 'grammar',
  category: 'IA de texto',
  usage: '<texto>',
  description: 'Corrección de gramática y ortografía.',
  async execute(context, services) {
    return services.runGrammar(context, context.args);
  },
};
