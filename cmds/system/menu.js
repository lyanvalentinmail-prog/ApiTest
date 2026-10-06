export default {
  name: 'menu',
  aliases: ['help', 'ayuda'],
  category: 'Sistema',
  usage: '',
  description: 'Muestra el menú principal y la lista completa de comandos.',
  async execute(context, services) {
    return services.runMenu(context);
  },
};
