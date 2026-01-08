// BY: MrGeH - Versão Final v12

require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');

const {
    Client, GatewayIntentBits, EmbedBuilder, ActivityType, ModalBuilder,
    TextInputBuilder, TextInputStyle, ActionRowBuilder, Collection,
    PermissionFlagsBits, MessageFlags, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ComponentType,
    ChannelType
} = require('discord.js');

const { translate } = require('@vitalets/google-translate-api');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const PREFIX = '!dtg';

// GIF Fixo para os Avisos
const AVISO_GIF_URL = "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExamQxcGRlanRhNWZvNnBnNnM3MDhqYXR2MmJ2czE1ZTQ0N2NkZHJsNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/vqGMs1Sgv0y5gnbkMP/giphy.gif";

if (!TOKEN || !OWNER_ID || !process.env.DISCORD_CLIENT_ID) {
    console.error("Erro: As variáveis DISCORD_TOKEN, OWNER_ID e DISCORD_CLIENT_ID precisam ser definidas no arquivo .env");
    process.exit(1);
}

const configPath = './config.json';

function loadConfig() {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (error) {
            console.error("Erro ao ler config.json. Criando um novo arquivo.", error);
            const defaultConfig = { presentationChannelId: null, logChannelId: null };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
    }
    const defaultConfig = { presentationChannelId: null, logChannelId: null };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
}

let config = loadConfig();

function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const embedColors = ['#5865F2', '#0099ff', '#41B454', '#E67E22', '#E91E63', '#9B59B6', '#F1C40F', '#1ABC9C', '#2ECC71', '#3498DB', '#E74C3C'];
function getRandomColor() { return embedColors[Math.floor(Math.random() * embedColors.length)]; }

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const cooldowns = new Collection();
const prefixCooldowns = new Collection();
client.tempPedidoData = new Collection();
client.tempAvisoData = new Collection();
client.tempAddJogoData = new Collection();
client.activeChats = new Collection();

client.on('clientReady', () => { 
    console.log(`Bot ${client.user.tag} está online!`);
    const activities = ['Melhor Discord de Jogos e Software', 'Criado por MrGeH!', 'Siga as Regras!', 'Ainda sendo desenvolvido!', 'Best Discord for Games and Software', 'Created by MrGeH!', 'Follow the Rules!', 'Still under development!'];
    let i = 0;
    setInterval(() => {
        client.user.setActivity(activities[i], { type: ActivityType.Playing });
        i = ++i % activities.length;
    }, 15000);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- SISTEMA DE CHAT PRIVADO ---
    // 1. Se o usuário manda mensagem na DM e tem um chat aberto
    if (message.channel.type === ChannelType.DM) {
        const activeChannelId = client.activeChats.get(message.author.id);
        if (activeChannelId) {
            const channel = client.channels.cache.get(activeChannelId);
            if (channel) {
                const embedDM = new EmbedBuilder()
                    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                    .setDescription(message.content || '*Sem conteúdo de texto*')
                    .setColor('#00ff00') // Verde para mensagens do usuário
                    .setTimestamp();
                const files = message.attachments.map(a => a.url);
                await channel.send({ embeds: [embedDM], files: files });
                await message.react('📨');
            }
            return;
        }
    }

    // 2. Se o staff manda mensagem no canal privado do ticket
    if (message.guild && client.activeChats.has(message.channel.id)) {
        const targetUserId = client.activeChats.get(message.channel.id);
        const targetUser = await client.users.fetch(targetUserId).catch(() => null);

        if (targetUser) {
            const embedStaff = new EmbedBuilder()
                .setAuthor({ name: `Staff: ${message.author.username}`, iconURL: message.guild.iconURL() })
                .setDescription(message.content || '*Arquivo enviado*')
                .setColor('#ff0000') // Vermelho para mensagens da Staff
                .setTimestamp();
            const files = message.attachments.map(a => a.url);
            try {
                await targetUser.send({ embeds: [embedStaff], files: files });
                await message.react('✅');
            } catch (error) {
                await message.reply('❌ Não foi possível enviar a mensagem para o usuário (DM fechada?).');
            }
        }
        return;
    }

    // --- LÓGICA DE UPLOAD DE IMAGEM PARA ADDJOGO/ADDSOFT ---
    if (client.tempAddJogoData.has(message.author.id)) {
        const data = client.tempAddJogoData.get(message.author.id);
        if (data.status === 'awaiting_image') {
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType.startsWith('image')) {
                client.tempAddJogoData.delete(message.author.id);
                await sendGameOrSoftwareEmbed(
                    data.interaction, data.primaryChannelId, data.notificationChannelId,
                    data.title, data.obs, data.link, attachment.url, data.type
                );
                if (data.waitingMessageId) {
                    try {
                        const originalInteractionMessage = await message.channel.messages.fetch(data.waitingMessageId);
                        await originalInteractionMessage.delete().catch(() => {});
                    } catch (error) {}
                }
                await message.react('✅').catch(console.error);
                return;
            } else {
                await message.reply({ content: '❌ Por favor, envie apenas a imagem.', flags: [MessageFlags.Ephemeral] }).catch(console.error);
            }
        }
    }

    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return message.reply('Este comando só pode ser usado em um servidor.').catch(console.error);

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const ownerOnlyPrefixCommands = ['ajogo'];
    if (ownerOnlyPrefixCommands.includes(command)) {
        if (message.author.id !== OWNER_ID) return message.reply({ content: '❌ Apenas o dono.' });
    }
    if (command === 'ajuda') await handleAjudaPrefix(message);
    else if (command === 'ajogo') await message.reply({ content: 'Use `/dtg addjogo`.', flags: [MessageFlags.Ephemeral] });
    else message.reply(`O comando \`!dtg ${command}\` foi movido para os comandos de barra.`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) {
        if (interaction.isRepliable()) return interaction.reply({ content: 'Use em um servidor.', flags: [MessageFlags.Ephemeral] });
        return;
    }

    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;
        if (commandName === 'dtg') {
            const subcommand = options.getSubcommand();
            const ownerOnly = ['aviso', 'addsoft', 'addjogo', 'limpar', 'addpedido'];
            if (ownerOnly.includes(subcommand) && interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: '❌ Apenas o dono.', flags: [MessageFlags.Ephemeral] });
            }

            if (subcommand === 'ajuda') await handleAjudaSlash(interaction);
            else if (subcommand === 'convite') { 
                 const gifUrl = 'https://media.discordapp.net/attachments/1132735302163779725/1425212324100309084/DTG.gif';
                 const inviteMessage = `**🇧🇷 Quer convidar um amigo?** ❤️\nEntre na nossa comunidade! Vários jogos e softwares para baixar e você também pode fazer o seu pedido!\n**Entre na DownTorrentsGames!!!**\n\n**🇺🇸 Want to invite a friend?** ❤️\nJoin our community! Several games e software to download and you can also place your order!\n**Join DownTorrentsGames!!!**\n\nhttps://discord.gg/uKCrBCNqCT`;
                 await interaction.reply({ content: `${gifUrl}\n\n${inviteMessage}`, ephemeral: false });
            }
            else if (subcommand === 'aviso') await handleAvisoChat(interaction);
            else if (subcommand === 'addsoft') { 
                const p = options.getChannel('canal_principal'); const n = options.getChannel('canal_notificacao');
                const m = new ModalBuilder().setCustomId(`addsoft_modal_${p.id}_${n.id}`).setTitle('Adicionar Software');
                m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addsoft_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addsoft_link').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(m);
            }
            else if (subcommand === 'addjogo') {
                const p = options.getChannel('canal_principal'); const n = options.getChannel('canal_notificacao');
                const m = new ModalBuilder().setCustomId(`addjogo_modal_${p.id}_${n.id}`).setTitle('Adicionar Jogo');
                m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_obs').setLabel("Obs").setStyle(TextInputStyle.Paragraph).setRequired(false)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_link').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(m);
            }
            else if (subcommand === 'limpar') await handleLimparSlash(interaction);
            else if (subcommand === 'addpedido') { 
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const pc = options.getChannel('canal_apresentacao'); const lc = options.getChannel('canal_logs');
                config.presentationChannelId = pc.id; config.logChannelId = lc.id; saveConfig();
                const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('iniciar_pedido_pt').setLabel('Fazer Pedido!').setStyle(ButtonStyle.Success).setEmoji('🇧🇷'), new ButtonBuilder().setCustomId('iniciar_pedido_en').setLabel('Make Request!').setStyle(ButtonStyle.Primary).setEmoji('🇺🇸'));
                await pc.send({ content: `**🇧🇷 Faça o Pedido do seu JOGO ou SOFTWARE clicando no botão abaixo:**\n\n**🇺🇸 Make your GAME or SOFTWARE request by clicking the button below:**\n\nhttps://media.discordapp.net/attachments/1132735302163779725/1425212324100309084/DTG.gif`, components: [buttons] });
                await interaction.editReply({ content: `✅ Configurado!` });
            }
            else if (subcommand === 'pedido' || subcommand === 'order') await sendPedidoInitialEphemeralMessage(interaction, subcommand === 'order');
        }
    }
    else if (interaction.isButton()) {
        if (interaction.customId === 'iniciar_pedido_pt' || interaction.customId === 'iniciar_pedido_en') {
            await sendPedidoInitialEphemeralMessage(interaction, interaction.customId === 'iniciar_pedido_en'); return;
        }
        
        if (interaction.customId.startsWith('pedido_continue_button_')) {
             const parts = interaction.customId.split('_'); const userId = parts[3]; const lang = parts[4]; const isEn = lang === 'en';
             if (interaction.user.id !== userId) return interaction.reply({ content: '❌', flags: [MessageFlags.Ephemeral] });
             const d = client.tempPedidoData.get(userId);
             if (!d || !d.platform) return interaction.reply({ content: '❌', flags: [MessageFlags.Ephemeral] });
             
             await handlePedidoModalFinal(interaction, d.platform, d.online, isEn);
             
             try { setTimeout(async () => { try { await interaction.message.delete(); } catch(e) {} }, 1000); } catch(e){}
             client.tempPedidoData.delete(userId);
        }
        else if (interaction.customId.startsWith('start_chat_')) {
            const tId = interaction.customId.split('_')[2];
            if (client.activeChats.has(tId)) return interaction.reply({ content: `⚠️ Já aberto: <#${client.activeChats.get(tId)}>`, flags: [MessageFlags.Ephemeral] });
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            try {
                const tUser = await client.users.fetch(tId);
                const c = await interaction.guild.channels.create({ name: `chat-${tUser.username}`, type: ChannelType.GuildText, permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
                client.activeChats.set(tId, c.id); client.activeChats.set(c.id, tId);
                const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`close_chat_${tId}`).setLabel('Finalizar Chat e Salvar Backup').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
                await c.send({ content: `👋 **Chat iniciado com ${tUser}** por ${interaction.user}.\n\nTodas as mensagens enviadas aqui serão encaminhadas para a DM do usuário.\nTodas as respostas do usuário na DM aparecerão aqui.`, components: [btn] });
                try { await tUser.send(`📩 **Olá!** Um membro da equipe **DownTorrents Games** iniciou um atendimento com você.\n\nVocê pode responder diretamente por aqui e a mensagem será encaminhada para o suporte.`); } catch (dmError) { await channel.send(`⚠️ **Aviso:** Não consegui enviar DM para o usuário. Ele pode ter DMs bloqueadas.`); }
                await interaction.editReply({ content: `✅ Chat criado com sucesso: ${c}` });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ Erro ao criar o chat privado.' });
            }
        }
        else if (interaction.customId.startsWith('close_chat_')) {
            const tId = interaction.customId.split('_')[2]; const c = interaction.channel;
            await interaction.reply({ content: '🔒 Encerrando chat e gerando backup...', flags: [MessageFlags.Ephemeral] });
            try {
                const msgs = await c.messages.fetch({ limit: 100 });
                const txt = msgs.reverse().map(m=>`[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content} ${m.attachments.size > 0 ? '[Anexo]' : ''}`).join('\n');
                if (config.logChannelId) { const l = await client.channels.fetch(config.logChannelId); if(l) await l.send({ content: `📁 **Backup de Chat**\n**Usuário:** <@${tId}>\n**Staff:** ${interaction.user}`, files: [{ attachment: Buffer.from(txt), name: `transcript-${tId}.txt` }] }); }
                const u = await client.users.fetch(tId).catch(()=>{}); if(u) await u.send('🔒 **Atendimento Encerrado.** Obrigado!').catch(()=>{});
                client.activeChats.delete(tId); client.activeChats.delete(c.id);
                setTimeout(()=>c.delete(), 5000);
            } catch(e){ console.error("Erro chat", e); }
        }
        else if (interaction.customId.startsWith('pedido_added_') || interaction.customId.startsWith('pedido_rejected_')) {
            if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Apenas o dono.', flags: [MessageFlags.Ephemeral] });

            const parts = interaction.customId.split('_');
            const userId = parts[2];
            const gameSoftwareName = parts[3].replace(/_/g, ' ');
            const platform = parts[4].replace(/_/g, ' ');
            const onlineStatus = parts[5].replace(/_/g, ' ');
            const lang = parts[6];
            const isEnglish = lang === 'en';

            await interaction.deferUpdate();

            let dmTitle, dmBodyFn, responseStatus;

            if (parts[1] === 'added') {
                dmTitle = isEnglish ? "CONGRATULATIONS - YOUR GAME HAS BEEN ADDED!" : "**PARABÉNS - SEU JOGO FOI ADICIONADO!**";
                
                dmBodyFn = (gName, plat, online, isEn) => {
                    let body = isEn 
                        ? `Your request for **${gName} / ${plat}** has been fulfilled!\n\n`
                        : `Seu pedido para **${gName} / ${plat}** foi atendido!\n\n`;

                    if (plat.toLowerCase().includes('pc') || plat.toLowerCase().includes('outros') || plat.toLowerCase().includes('others')) {
                        body += isEn 
                            ? `If the platform you chose was "PC" or "Others (Software)", the item will be in the text channel with the first letter of its name. Example: you requested "Minecraft", it will be under the letter "M".\n\n`
                            : `Caso a Plataforma que escolheu foi "PC" ou "Outros (Software)" o item vai estar no chat de texto com a letra do primeiro nome do item. Exemplo: você pediu "Minecraft" o item estara adicionado a Letra "M".\n\n`;
                    } else {
                        body += isEn
                            ? `If the chosen platform is an emulator/console, go to the game list for the console you chose. Example: if it's PS1, go to the PS1 games.\n\n`
                            : `Caso a Plataforma escolhida for de emulador/Vídeo game, vá na lista de jogos referente o vídeo game que escolheu. Exemplo: se for PS1, vá nos jogos de PS1.\n\n`;
                    }

                    if (online.toLowerCase() === 'sim' || online.toLowerCase() === 'yes') {
                        body += isEn
                            ? `If you requested "Online Playability", it will be in the CO-OP / ONLINE category - NOTE: IF YOU SEARCHED IN CO-OP AND DIDN'T FIND THE GAME, THEN IT MEANS THE GAME IS NOT AVAILABLE FOR ONLINE, SO FOLLOW THE EXAMPLE ABOVE!\n\n`
                            : `Caso você tenha pedido para verificar a possibilidade de Jogado ONLINE ele estará na categoria CO-OP / ONLINE - OBSERVAÇÃO: CASO PROCUROU NO COOP E NÃO ACHOU O JOGO, ENTÃO SIGNIFICA QUE O JOGO NÃO TEM PARA ONLINE ENTÃO SENDO ASSIM SIGA O EXEMPLO DE CIMA!\n\n`;
                    }

                    body += isEn ? `**THANK YOU - MrGeH.**` : `**MUITO OBRIGADO - MrGeH.**`;
                    return body;
                };
                responseStatus = isEnglish ? 'Added' : 'Adicionado';

            } else { 
                dmTitle = isEnglish ? "NOTICE ABOUT YOUR REQUEST" : "**AVISO SOBRE SEU PEDIDO**";
                dmBodyFn = (gName, plat, online, isEn) => isEn
                    ? `Unfortunately, your request for **${gName} / ${plat}** could not be fulfilled at this time (Reason: **No Crack/Unavailable**).\n\n**THANK YOU - MrGeH.**`
                    : `Infelizmente, seu pedido para **${gName} / ${plat}** não pôde ser atendido no momento (Motivo: **Sem Crack/Indisponível**).\n\n**MUITO OBRIGADO - MrGeH.**`;
                responseStatus = isEnglish ? 'No Crack' : 'Sem Crack';
            }

            try {
                const user = await client.users.fetch(userId);
                await user.send(`${dmTitle}\n\n${dmBodyFn(gameSoftwareName, platform, onlineStatus, isEnglish)}`);
                const disabledButtons = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                    ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                    ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                );
                await interaction.message.edit({ components: [disabledButtons] });
                await interaction.channel.send(`*Resposta enviada ao usuário (${user.tag}) para "${gameSoftwareName}": **${responseStatus}***`);
            } catch (dmError) {
                console.error('Falha ao enviar DM:', dmError);
                await interaction.followUp({ content: `❌ Falha ao enviar DM.`, flags: [MessageFlags.Ephemeral] });
            }
        }
    }
    else if (interaction.isModalSubmit()) {
        const { customId, fields } = interaction;

        if (customId.startsWith('pedido_modal_final_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const [, , , userId, platform, onlineStatus, lang] = customId.split('_');
            const isEnglish = lang === 'en';

            const requestInfo = fields.getTextInputValue('pedido_info_msg');
            const gameSoftwareName = fields.getTextInputValue('pedido_game_software_name');
            const originalLink = fields.getTextInputValue('pedido_original_link');

            const logChannel = await client.channels.fetch(config.logChannelId);
            if (!logChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(logChannel.type)) return interaction.editReply({ content: '❌ Log channel error.', flags: [MessageFlags.Ephemeral] });

            const embedPedido = new EmbedBuilder()
                .setTitle(`Pedido de Jogo/Software`)
                .setColor(getRandomColor())
                .setDescription(`**Usuário:** ${interaction.user.tag} / ID: ${interaction.user.id}\n**Nome do Jogo/Software:** ${gameSoftwareName}\n**Plataforma:** ${platform.replace(/_/g, ' ')}\n**Possibilidade de ser Jogável ONLINE:** ${onlineStatus.replace(/_/g, ' ')}\n**Link do Jogo Original:** [Link](${originalLink})\n${requestInfo ? `**Informações Adicionais:**\n\`\`\`${requestInfo}\`\`\`` : ''}`);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pedido_added_${userId}_${gameSoftwareName.replace(/ /g, '_')}_${platform.replace(/ /g, '_')}_${onlineStatus.replace(/ /g, '_')}_${lang}`).setLabel(isEnglish ? 'Mark as Added' : 'Marcar como Adicionado').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`pedido_rejected_${userId}_${gameSoftwareName.replace(/ /g, '_')}_${platform.replace(/ /g, '_')}_${onlineStatus.replace(/ /g, '_')}_${lang}`).setLabel(isEnglish ? 'Mark as No Crack' : 'Marcar como Sem Crack').setStyle(ButtonStyle.Danger).setEmoji('❌'),
                new ButtonBuilder().setCustomId(`start_chat_${userId}`).setLabel('Enviar Mensagem / Iniciar Chat').setStyle(ButtonStyle.Primary).setEmoji('💬')
            );

            await logChannel.send({ embeds: [embedPedido], components: [buttons] });
            await interaction.editReply({ content: isEnglish ? '✅ Request submitted!' : '✅ Seu pedido foi enviado com sucesso!', flags: [MessageFlags.Ephemeral] });

            const userData = client.tempPedidoData.get(userId);
            if (userData && userData.ephemeralMessageId) {
                try {
                    const channel = await client.channels.fetch(interaction.channelId);
                    const messageToDelete = await channel.messages.fetch(userData.ephemeralMessageId);
                    await messageToDelete.delete().catch(() => {});
                } catch (error) {}
            }
            client.tempPedidoData.delete(userId);
        }
        else if (customId.startsWith('addsoft_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const [ , , primaryChannelId, notificationChannelId ] = customId.split('_');
            const softwareTitulo = fields.getTextInputValue('addsoft_titulo');
            const softwareLink = fields.getTextInputValue('addsoft_link');
            client.tempAddJogoData.set(interaction.user.id, { status: 'awaiting_image', interaction: interaction, primaryChannelId, notificationChannelId, title: softwareTitulo, obs: null, link: softwareLink, type: 'software' });
            const waitingMessage = await interaction.editReply({ content: '✅ Informações do software recebidas. **Por favor, envie a imagem/capa do software para este chat AGORA.**', flags: [MessageFlags.Ephemeral] });
            const data = client.tempAddJogoData.get(interaction.user.id);
            data.waitingMessageId = waitingMessage.id;
            client.tempAddJogoData.set(interaction.user.id, data);
            return; 
        }
        else if (customId.startsWith('addjogo_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const [ , , primaryChannelId, notificationChannelId ] = customId.split('_');
            const title = fields.getTextInputValue('addjogo_titulo');
            const obs = fields.getTextInputValue('addjogo_obs');
            const link = fields.getTextInputValue('addjogo_link');
            client.tempAddJogoData.set(interaction.user.id, { status: 'awaiting_image', interaction: interaction, primaryChannelId, notificationChannelId, title, obs, link, type: 'jogo' });
            const waitingMessage = await interaction.editReply({ content: '✅ Informações do jogo recebidas. **Por favor, envie a imagem do jogo/capa para este chat AGORA.**', flags: [MessageFlags.Ephemeral] });
            const data = client.tempAddJogoData.get(interaction.user.id);
            data.waitingMessageId = waitingMessage.id;
            client.tempAddJogoData.set(interaction.user.id, data);
            return; 
        }
        else if (customId.startsWith('aviso_modal_')) {
            // --- AVISO COM TRADUÇÃO ---
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            
            const [ , , userId, lang ] = customId.split('_');
            const avisoTitulo = fields.getTextInputValue('aviso_titulo');
            const avisoCorpo = fields.getTextInputValue('aviso_corpo');

            const avisoData = client.tempAvisoData.get(userId);
            if (!avisoData || !avisoData.channels) return interaction.editReply({ content: '❌ Erro canais.', flags: [MessageFlags.Ephemeral] });

            let finalTitle = avisoTitulo;
            let finalDescription = avisoCorpo;

            try {
                const resTitle = await translate(avisoTitulo, { to: 'en' });
                const resBody = await translate(avisoCorpo, { to: 'en' });

                finalTitle = avisoTitulo;
                finalDescription = `${avisoCorpo}\n\n---------------------\n\n**${resTitle.text}**\n\n${resBody.text}`;
            } catch (err) {
                console.error("Erro na tradução:", err);
            }

            const embedAviso = new EmbedBuilder()
                .setTitle(finalTitle)
                .setDescription(finalDescription)
                .setColor(getRandomColor())
                .setTimestamp()
                .setThumbnail(AVISO_GIF_URL)
                .setFooter({ text: `Aviso por ${interaction.user.username}` });

            for (const channelId of avisoData.channels) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    if (channel) {
                        await channel.send({ content: '@everyone', embeds: [embedAviso] });
                    }
                } catch (error) {
                    console.error(`Erro envio aviso:`, error);
                }
            }

            await interaction.editReply({ content: '✅ Aviso enviado com Tradução!', flags: [MessageFlags.Ephemeral] });
            client.tempAvisoData.delete(userId);
        }
    }
    else if (interaction.isStringSelectMenu()) {
        const { customId } = interaction;
        if (customId.startsWith('pedido_platform_select_') || customId.startsWith('pedido_online_select_')) {
            const parts = customId.split('_');
            const expectedUserId = parts[3];
            const lang = parts[4];
            const isEnglish = lang === 'en';
            if (interaction.user.id !== expectedUserId) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                return interaction.editReply({ content: '❌' });
            }
            let userData = client.tempPedidoData.get(expectedUserId) || { platform: null, online: null, ephemeralMessageId: null };
            if (customId.startsWith('pedido_platform_select_')) userData.platform = interaction.values[0];
            else userData.online = interaction.values[0];
            client.tempPedidoData.set(expectedUserId, userData);

            const canContinue = !!userData.platform && !!userData.online;
            const continueButton = new ButtonBuilder().setCustomId(`pedido_continue_button_${expectedUserId}_${lang}`).setLabel(isEnglish ? 'Continue Request' : 'Continuar Pedido').setStyle(ButtonStyle.Success).setDisabled(!canContinue);
            const actionRowButton = new ActionRowBuilder().addComponents(continueButton);

            try {
                await interaction.update({
                    content: `**${isEnglish ? 'Selected Platform' : 'Plataforma Selecionada'}:** \`${userData.platform||'-'}\`\n**${isEnglish ? 'Online Playability' : 'Jogável Online'}:** \`${userData.online||'-'}\`\n\n` + (isEnglish ? 'Please select both options.' : 'Por favor, selecione ambas as opções.'),
                    components: [getPedidoPlatformSelectMenu(expectedUserId, lang, userData.platform), getPedidoOnlineSelectMenu(expectedUserId, lang, userData.online), actionRowButton]
                });
            } catch (error) { await interaction.followUp({ content: '❌ Erro.', flags: [MessageFlags.Ephemeral] }); }
        }
    }
});

// --- FUNÇÕES DE HANDLER ---
async function handleAjudaPrefix(message) {
    const embed = new EmbedBuilder().setTitle('Comandos de Ajuda').setDescription(`**Prefix:** \`${PREFIX}\`\n\nUse comandos de barra.`).setColor(getRandomColor());
    await message.reply({ embeds: [embed] }).catch(console.error);
}

async function handleAjudaSlash(interaction) {
    const embed = new EmbedBuilder().setTitle('Comandos de Ajuda').setDescription('**Comandos de Barra (/)**\n\nUse `/dtg` para ver as opções.').setColor(getRandomColor());
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] }).catch(console.error);
}

async function handleAvisoChat(interaction) {
    const userId = interaction.user.id;
    let channels = [];
    const selCh = interaction.options.getChannel('canal'); 
    
    if (selCh) channels.push(selCh.id);
    else channels.push(interaction.channel.id);

    client.tempAvisoData.set(userId, { channels });

    const modal = new ModalBuilder().setCustomId(`aviso_modal_${userId}_pt`).setTitle('Criar Aviso');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aviso_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aviso_corpo').setLabel("Mensagem").setStyle(TextInputStyle.Paragraph).setRequired(true)));
    
    await interaction.showModal(modal);
}

async function handleLimparSlash(interaction) {
    const amount = interaction.options.getInteger('quantidade');
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ Sem permissão.', flags: [MessageFlags.Ephemeral] });
    if (amount <= 0 || amount > 100) return interaction.reply({ content: '❌ 1-100.', flags: [MessageFlags.Ephemeral] });
    try { await interaction.channel.bulkDelete(amount, true); await interaction.reply({ content: `✅ ${amount} mensagens limpas.`, flags: [MessageFlags.Ephemeral] }); } catch (error) { await interaction.reply({ content: '❌ Erro.', flags: [MessageFlags.Ephemeral] }); }
}

// *** FUNÇÕES AUXILIARES ***
async function sendPedidoInitialEphemeralMessage(interaction, isEnglish) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const userId = interaction.user.id; const lang = isEnglish ? 'en' : 'pt';
    client.tempPedidoData.set(userId, { platform: null, online: null, ephemeralMessageId: null });
    const continueButton = new ButtonBuilder().setCustomId(`pedido_continue_button_${userId}_${lang}`).setLabel(isEnglish ? 'Continue Request' : 'Continuar Pedido').setStyle(ButtonStyle.Success).setDisabled(true); 
    const initialMessageContent = isEnglish ? 'Please select options:' : 'Por favor, selecione as opções:';
    let sentMessage; 
    const payload = { content: initialMessageContent, components: [getPedidoPlatformSelectMenu(userId, lang), getPedidoOnlineSelectMenu(userId, lang), new ActionRowBuilder().addComponents(continueButton)], flags: [MessageFlags.Ephemeral], fetchReply: true };
    if (interaction.replied || interaction.deferred) sentMessage = await interaction.followUp(payload);
    else sentMessage = await interaction.reply(payload);
    const userData = client.tempPedidoData.get(userId); userData.ephemeralMessageId = sentMessage.id; client.tempPedidoData.set(userId, userData);
}

function getPedidoPlatformSelectMenu(userId, lang, currentValue = null) {
    const isEnglish = lang === 'en';
    const options = [
        {l:'PC',v:'PC'},{l:'PS1',v:'PS1'},{l:'PS2',v:'PS2'},{l:'PS3',v:'PS3'},{l:'PS4',v:'PS4'},{l:'PS5',v:'PS5'},
        {l:'XBOX 360',v:'XBOX 360'},{l:'XBOX ONE',v:'XBOX ONE'},{l:'XBOX SERIES',v:'XBOX SERIES'},
        {l:'SWITCH',v:'NINTENDO SWITCH'},{l:'3DS',v:'NINTENDO 3DS'},{l:'WII',v:'NINTENDO WII'},{l:'WII U',v:'NINTENDO WII U'},
        {l:isEnglish?'OTHERS':'OUTROS (Software)',v:'OUTROS (Software)'}
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.l).setValue(o.v).setDefault(o.v === currentValue));
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pedido_platform_select_${userId}_${lang}`).setPlaceholder(isEnglish?'Platform':'Plataforma').addOptions(options));
}

function getPedidoOnlineSelectMenu(userId, lang, currentValue = null) {
    const isEnglish = lang === 'en';
    const options = [{l:isEnglish?'Yes':'Sim',v:'Sim'},{l:isEnglish?'No':'Não',v:'Não'},{l:isEnglish?'Irrelevant':'Irrelevante',v:'Irrelevante_Software'}]
        .map(o => new StringSelectMenuOptionBuilder().setLabel(o.l).setValue(o.v).setDefault(o.v === currentValue));
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pedido_online_select_${userId}_${lang}`).setPlaceholder(isEnglish?'Online?':'Online?').addOptions(options));
}

async function handlePedidoModalFinal(interaction, platform, onlineStatus, isEnglish) {
    const userId = interaction.user.id;
    const lang = isEnglish ? 'en' : 'pt';

    const modal = new ModalBuilder()
        .setCustomId(`pedido_modal_final_${userId}_${platform.replace(/ /g, '_')}_${onlineStatus.replace(/ /g, '_')}_${lang}`)
        .setTitle(isEnglish ? 'Request Details' : 'Detalhes do Pedido');

    const gameSoftwareNameInput = new TextInputBuilder()
        .setCustomId('pedido_game_software_name')
        .setLabel(isEnglish ? 'Game/Software Name' : 'Nome do Jogo/Software')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const originalLinkInput = new TextInputBuilder()
        .setCustomId('pedido_original_link')
        .setLabel(isEnglish ? "Link Page" : "Link da Página")
        .setPlaceholder(isEnglish ? "Ex: steam.com/game" : "Ex: steam.com/jogo")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const requestInfoInput = new TextInputBuilder()
        .setCustomId('pedido_info_msg')
        .setLabel(isEnglish ? 'Additional Info' : 'Informações Adicionais')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(gameSoftwareNameInput),
        new ActionRowBuilder().addComponents(originalLinkInput),
        new ActionRowBuilder().addComponents(requestInfoInput)
    );

    await interaction.showModal(modal);
}

async function sendGameOrSoftwareEmbed(originalInteraction, primaryChannelId, notificationChannelId, title, obs, link, imageUrl, type) {
    const isJogo = type === 'jogo';
    const mainChannel = await originalInteraction.guild.channels.fetch(primaryChannelId);
    const notifChannel = await originalInteraction.guild.channels.fetch(notificationChannelId);
    let mainContent = `**${title}**\n\n**Link:** [Clique Aqui! | Click Here!](${link})`;
    if (obs) mainContent += `\n\nObservação: ${obs}`;
    let mainMessageOptions = { content: mainContent };
    if (imageUrl) mainMessageOptions.files = [{ attachment: imageUrl, name: 'image.png' }];
    const sentMainMessage = await mainChannel.send(mainMessageOptions);
    const embedNotification = new EmbedBuilder().setColor(getRandomColor()).setTitle(`🎉 Novo ${isJogo ? 'Jogo' : 'Software'} Disponível!`)
        .setDescription(`🇧🇷 Confira o novo ${isJogo ? 'jogo' : 'software'}: **${title}**\n🇺🇸 Check out the new ${isJogo ? 'game' : 'software'}: **${title}**`);
    if (imageUrl) embedNotification.setThumbnail(imageUrl);
    const detailsButton = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Clique Aqui para Mais Detalhes! | Click Here for More Details!').setURL(sentMainMessage.url));
    await notifChannel.send({ content: '@everyone', embeds: [embedNotification], components: [detailsButton] });
    await originalInteraction.editReply({ content: `✅ Sucesso!`, flags: [MessageFlags.Ephemeral] });
}

client.login(TOKEN);