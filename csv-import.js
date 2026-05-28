Draw.loadPlugin(function (ui) {
    const buttonsMap = new Map([
        ["Prefs", "openPrefsAction"],
        ["Toggle Container", "toggleContainerAction"],
        ["Layout", "applyLayoutAction"],
        ["Import", "runImportAction"]
    ]);

    ui.actions.addAction('openPrefsAction', () => openPrefsAction(ui));
    ui.actions.addAction('toggleContainerAction', () => {
        let wd = loadingWindow();
        setTimeout(async () => {
            try {
                toggleContainerAction(ui);
            } finally {
                wd.destroy();
            }
        }, 0);
    });
    ui.actions.addAction('applyLayoutAction', () => {
        let wd = loadingWindow();
        setTimeout(async () => {
            try {
                applyLayoutAction(ui);
            } finally {
                wd.destroy();
            }
        }, 0);
    });
    ui.actions.addAction('runImportAction', () => runImportAction(ui));

    let toolbar = ui.toolbar.container;

    for (const [key, value] of buttonsMap) {
        console.log(`${key}: ${value}`);
        let btn = document.createElement('button');
        btn.className = 'geBtn';
        btn.style.margin = '0 5px';
        btn.innerHTML = key;
        btn.onclick = function () {
            ui.actions.get(value).funct();
        }
        toolbar.appendChild(btn);
    }

});

function loadingWindow() {

    let div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.padding = '20px';

    div.innerHTML = '<div class="geStatusAlert" style="cursor:default;padding:10px;">' +
        '<img src="images/spin.gif" style="vertical-align:middle;margin-right:10px;"/>' +
        '<span id="progresso-txt">Running...</span></div><br/>';
    let wnd = new mxWindow('CSV Import Plugin', div, 300, 200, 220, 120, false, true);
    wnd.setClosable(false);
    wnd.setVisible(true);
    let x = Math.max(0, (document.body.scrollWidth - wnd.table.clientWidth) / 2);
    let y = Math.max(0, (document.documentElement.clientHeight - wnd.table.clientHeight) * 0.4);
    wnd.setLocation(x, y);

    return wnd;
}

function loadPrefs() {
    let storageValue = localStorage.getItem('drawio_cvs_import_plugin_prefs');
    let preferencias = storageValue ? JSON.parse(storageValue) : {
        layoutsJson: [
            {
                layout: "mxHierarchicalLayout",
                config: {
                    orientation: "north",
                    intraCellSpacing: 60,
                    interRankCellSpacing: 80,
                    fineTuning: true,
                    straightening: true,
                    fixRoots: false,
                    disableEdgeStyle: false
                }
            },
            {
                layout: "mxParallelEdgeLayout",
                config: {
                    spacing: 30
                }
            }
        ]
    }
    return preferencias;
}
function savePrefs(preferencias) {
    localStorage.setItem('drawio_cvs_import_plugin_prefs', JSON.stringify(preferencias, null, 2));
}

function openPrefsAction(ui) {
    let div = document.createElement('div');
    div.innerHTML = '<h4>Preferências de Layout</h4>' +
        '<textarea id="jsonConfig" rows="20" style="width:100%;"></textarea><br/>' +
        '<button id="btnSalvar"class="geBtn">Salvar</button>';

    let textarea = div.querySelector('#jsonConfig');
    let prefsAtuais = loadPrefs();
    if (prefsAtuais) {
        textarea.value = JSON.stringify(prefsAtuais.layoutsJson, null, 2);
    }

    div.querySelector('#btnSalvar').onclick = function () {
        prefsAtuais.layoutsJson = JSON.parse(textarea.value);
        savePrefs(prefsAtuais);
        ui.hideDialog();
        ui.alert('Preferências salvas com sucesso!');
    };
    ui.showDialog(div, 600, 400, true, true);
}

function toggleContainerAction(ui) {
    let graph = ui.editor.graph;
    let model = graph.getModel();
    model.beginUpdate();
    try {
        let cells = graph.getSelectionCells();
        for (const cell of cells) {
            let style = cell.getStyle();
            if (style?.includes('container')) {
                let c = [];
                let a = style.split(';');
                for (const element of a)
                    if (!element.includes('container='))
                        c.push(element);
                    else if (element.split('=')[1] === '0')
                        c.push('container=1');
                    else {
                        c.push('container=0');
                        graph.ungroupCells([cell]);
                    }
                model.setStyle(cell, c.join(";"));
            }
        }
    } catch (e) {
        console.log('toggleContainerAction error: ', e.message);
        ui.alert('Erro ao executar Toggle Container: ' + e.message);
    } finally {
        model.endUpdate();
    }
}
function applyLayoutAction(ui) {
    let preferencias = loadPrefs();
    let graph = ui.editor.graph;
    let model = graph.model;
    let celulasSelecionadas = graph.getEditableCells(graph.getSelectionCells());
    model.beginUpdate();
    try {
        let layouts = graph.createLayouts(preferencias.layoutsJson);
        let composite = new mxCompositeLayout(graph, layouts);

        let camadaAtiva = graph.getDefaultParent();
        let conexoes;
        if (celulasSelecionadas && celulasSelecionadas.length > 0) {
            let grupoTemporario = graph.createVertex(null, null, '', 0, 0, 0, 0);
            graph.addCells([grupoTemporario], camadaAtiva);
            graph.moveCells(celulasSelecionadas, 0, 0, false, grupoTemporario);
            composite.execute(grupoTemporario);
            let filhosDoGrupo = graph.getChildCells(grupoTemporario, true, true);
            graph.moveCells(filhosDoGrupo, 0, 0, false, camadaAtiva);
            graph.removeCells([grupoTemporario]);
            graph.setSelectionCells(celulasSelecionadas);
            conexoes = graph.getChildEdges(celulasSelecionadas);
        } else {
            composite.execute(camadaAtiva);
            conexoes = graph.getChildEdges(camadaAtiva);
        }

        if (conexoes) {
            for (const edge of conexoes) {
                if (edge.geometry != null) {
                    let geo = edge.geometry.clone();
                    geo.points = null;
                    model.setGeometry(edge, geo);
                }
            }
        }

    } catch (e) {
        console.log('applyLayoutAction error: ', e.message);
        ui.alert('Erro ao executar Layout: ' + e.message);
    } finally {
        model.endUpdate();
    }
}

function runImportAction(ui) {
    let graph = ui.editor.graph;
    let model = graph.model;
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = function (e) {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.onload = function (e) {
            let csvData = e.target.result;
            // Step 3: Execute the import
            let wd = loadingWindow();
            setTimeout(async () => {
                model.beginUpdate();
                try {
                    importCsvToDiagram(ui, csvData);
                } finally {
                    model.endUpdate();
                    wd.destroy();
                }
            }, 0);
        };
        reader.readAsText(file);
    };
    input.click();
}

function importCsvToDiagram(ui, csvData) {
    try {
        ui.importCsv(csvData, function (cells) {
            let lines = csvData.split('\n');
            let config = [];
            let dataRows = [];
            lines.forEach(line => {
                if (line.startsWith('#')) {
                    if (line.includes('x-connect')) {
                        // Extrai a regra de conexão do cabeçalho # x-connect
                        config.push(JSON.parse(line.substring(line.indexOf('{'))));
                    }
                } else if (line.trim() !== '' && line.includes(',')) {
                    let matchRegex = /([^",]+)|"([^"]*)"/g;
                    let row = [];
                    let match;
                    while ((match = matchRegex.exec(line)) !== null) {
                        let value = match[2] === undefined ? match[1] : match[2];
                        row.push(value.trim());
                    }
                    if (row.length > 0) {
                        dataRows.push(row);
                    }
                }
            });

            let headers = dataRows.shift();
            for (const cfg of config) {
                executeConnnections(ui.editor.graph, headers, dataRows, cfg);
            }
            ui.editor.graph.setSelectionCells(cells);
            ui.editor.graph.scrollCellToVisible(cells[0]);
        });

    } catch (e) {
        mxUtils.alert('Error importing CSV: ' + e.message);
    }
}

function executeConnnections(graph, headers, dataRows, config) {
    let fromIdx = headers.indexOf(config.from);
    let toIdx = headers.indexOf(config.to);
    let isInverted = 'invert' in config && (config.invert === true || config.invert === "true");

    let vertices = graph.getChildVertices(graph.getDefaultParent());
    let cellMap = {};
    vertices.forEach(v => {
        let id = v.getAttribute('id') || v.id;
        cellMap[id] = v;
    });

    // 4. Criar as conexões
    graph.getModel().beginUpdate();
    try {
        dataRows.forEach(row => {

            let c4Technology;
            let c4Description;
            let c4Type = "Relationship";
            let sourceCell;
            let targetCell;
            let sourceIds = row[fromIdx] ? row[fromIdx].toString().replaceAll('"', '').split(',').map(id => id.trim()) : [];

            for (const srcId of sourceIds) {
                sourceCell = cellMap[srcId];
                targetCell = cellMap[row[toIdx]];

                if (!sourceCell || !targetCell) return; // Proteção contra linhas vazias

                if (isInverted) {
                    sourceCell = cellMap[row[toIdx]];
                    targetCell = cellMap[srcId];
                }

                if (sourceCell && targetCell) {

                    switch (config.from) {
                        case "repositories":
                            c4Description = "reads / writes";
                            assingRepositoryRelation();
                            break;

                        case "produces":
                            c4Description = "produces";
                            assingMessagingRelation();
                            break;

                        case "consumes":
                            c4Description = "consumes";
                            assingMessagingRelation();
                            break;
                        default:
                            c4Description = "api call";
                            assignServiceRelation();
                            break;
                    }

                    let connectionExists = checkExistingConnection();
                    if (!connectionExists) {
                        // Insere a nova conexão com estilo padrão
                        // graph.insertEdge(graph.getDefaultParent(), null, '', sourceCell, targetCell);
                        let doc = mxUtils.createXmlDocument();
                        let cellObject = doc.createElement('UserObject');

                        // Injeta os metadados requeridos pela especificação C4 do draw.io
                        cellObject.setAttribute('placeholders', '1');
                        cellObject.setAttribute('label', config.label);
                        cellObject.setAttribute('c4Technology', c4Technology);
                        cellObject.setAttribute('c4Type', c4Type);
                        cellObject.setAttribute('c4Description', c4Description);

                        // Insere a nova conexão encapsulando o objeto de dados C4
                        let newEdge = graph.insertEdge(graph.getDefaultParent(), null, cellObject, sourceCell, targetCell, config.style);

                        // Garante que o draw.io processe a geometria do texto de forma correta
                        newEdge.geometry.relative = true;
                    }
                }
            }

            function checkExistingConnection() {
                let existingEdges = graph.getEdgesBetween(sourceCell, targetCell);
                let connectionExists = false;
                for (const edge of existingEdges) {
                    // Checa se a origem real do edge é o nosso sourceCell
                    if (edge.getTerminal(true) === sourceCell && edge.getTerminal(false) === targetCell) {

                        if (edge.value != null && typeof edge.value === 'object') {

                            let currentTech = edge.value.getAttribute('c4Technology');
                            let currentType = edge.value.getAttribute('c4Type');
                            let currentDesc = edge.value.getAttribute('c4Description');

                            // Compara se todos os atributos C4 batem com o que veio no CSV
                            if (currentTech === c4Technology && currentType === c4Type) {
                                connectionExists = true;
                                c4Description = currentDesc;
                                break; // A conexão idêntica já existe, pula a criação
                            }
                        }
                    }
                }
                return connectionExists;
            }

            function assignServiceRelation() {
                if (targetCell.getAttribute('c4Description').toLowerCase().includes('webservice')) {
                    c4Technology = "soap / https";
                } else {
                    c4Technology = "json / https";
                }
            }

            function assingRepositoryRelation() {
                switch (targetCell.getAttribute('c4Technology')) {
                    case "NoSQL":
                        c4Technology = "in-process / NoSqlConnManager";
                        break;
                    case "Bucket":
                        c4Technology = "in-process / StorageManager";
                        break;
                    default:
                        c4Technology = "in-process / SqlConnManager";
                        break;
                }
            }

            function assingMessagingRelation() {
                if (targetCell.getAttribute('c4Technology') === "Queue") {
                    c4Technology = "in-process / QueueConnManager";
                } else {
                    c4Technology = "in-process / TopicConnManager";
                }
            }
        });
    } finally {
        graph.getModel().endUpdate();
    }

    graph.refresh();
}
