// ARQUIVO: importar_discord.js
// BY: MrGeH - Importador Inteligente Multi-Categoria

require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { Pool } = require('pg');

// --- CONFIGURAÇÃO ---
// Adicione aqui os IDs das categorias que você quer escanear
const CATEGORIAS_PARA_ESCANEAR = [
    '', // Categoria Jogos Coop/Online
    '',  // Categoria Jogos (Alfabeto)
    '' //SOFTWARE
];

const QUANTIDADE_POR_CANAL = 100; // Quantas mensagens ler em CADA canal

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Função para gerar tags
function gerarTagsAutomaticas(titulo) {
    const t = titulo.toLowerCase();
    const limpo = t.replace(/[^a-z0-9 ]/g, '');
    const palavras = limpo.split(' ');
    const sigla = palavras.map(p => p.length > 0 ? p[0] : '').join('');
    return `${t} ${limpo} ${sigla}`;
}

client.once('ready', async () => {
    console.log(`🤖 Logado como ${client.user.tag}`);
    console.log(`🔌 Conectando ao Banco de Dados...`);
    
    try {
        await pool.connect();
        const guild = client.guilds.cache.first(); 
        
        if (!guild) {
            console.error("❌ O bot não está em nenhum servidor!");
            process.exit(1);
        }

        let totalGeral = 0;

        // --- LOOP PELAS CATEGORIAS ---
        for (const catId of CATEGORIAS_PARA_ESCANEAR) {
            console.log(`\n📂 ------------------------------------------------`);
            console.log(`📂 Processando Categoria ID: ${catId}...`);

            // Busca canais APENAS dessa categoria específica
            const canaisDaCategoria = guild.channels.cache.filter(c => 
                c.parentId === catId && 
                c.type === ChannelType.GuildText
            );

            if (canaisDaCategoria.size === 0) {
                console.log(`⚠️ Nenhum canal de texto encontrado nesta categoria.`);
                continue;
            }

            console.log(`✅ Encontrados ${canaisDaCategoria.size} canais. Iniciando varredura...`);

            // --- LOOP PELOS CANAIS DA CATEGORIA ---
            for (const [id, canal] of canaisDaCategoria) {
                process.stdout.write(`📡 Lendo canal: #${canal.name}... `); // Log na mesma linha para limpar visual
                
                try {
                    const messages = await canal.messages.fetch({ limit: QUANTIDADE_POR_CANAL });
                    let contCanal = 0;

                    for (const [msgId, msg] of messages) {
                        if (msg.author.bot) continue;
                        if (!msg.content) continue;

                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const links = msg.content.match(urlRegex);

                        if (links && links.length > 0) {
                            const link = links[0];
                            let titulo = msg.content.replace(urlRegex, '').trim();
                            titulo = titulo.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' '); 

                            if (titulo.length < 2) titulo = `Jogo em #${canal.name}`;
                            if (titulo.length > 100) titulo = titulo.substring(0, 100);

                            const tags = gerarTagsAutomaticas(titulo);

                            // Verifica duplicidade no banco
                            const check = await pool.query('SELECT id FROM jogos WHERE link = $1', [link]);
                            
                            if (check.rowCount === 0) {
                                await pool.query(
                                    'INSERT INTO jogos (titulo, link, tipo, obs, tags_busca) VALUES ($1, $2, $3, $4, $5)',
                                    [titulo, link, 'jogo', `Importado de #${canal.name}`, tags]
                                );
                                contCanal++;
                                totalGeral++;
                            }
                        }
                    }
                    console.log(`( Novos: ${contCanal} )`);

                } catch (err) {
                    console.log(`\n❌ Erro ao ler canal ${canal.name}:`, err.message);
                }
            }
        }

        console.log(`\n🏁 ----------------------------------------`);
        console.log(`🏁 IMPORTAÇÃO FINALIZADA!`);
        console.log(`🏁 Total de Jogos Adicionados: ${totalGeral}`);
        console.log(`🏁 ----------------------------------------`);
        process.exit(0);

    } catch (error) {
        console.error("Erro fatal:", error);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);