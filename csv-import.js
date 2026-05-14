Draw.loadPlugin(function (ui) {

    let toolbar = ui.toolbar.container;

    let btn = document.createElement('button');
    btn.innerHTML = 'CSV';
    btn.className = 'geBtn';
    btn.style.margin = '0 5px';
    toolbar.appendChild(btn);
    btn.onclick = function () {
        ui.actions.get('runPlugInCsvImport').funct();
    }
    ui.actions.addAction('runPlugInCsvImport', function () {
        runPlugInCsvImport();
    });

    function runPlugInCsvImport() {
        let input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';

        input.onchange = function (e) {
            let file = e.target.files[0];
            let reader = new FileReader();
            reader.onload = function (e) {
                let csvData = e.target.result;
                // Step 3: Execute the import
                importCsvToDiagram(ui, csvData);
            };
            reader.readAsText(file);
        };
        input.click();
    }

});

// function importCsvToDiagram(ui, csvData) {
//     let graph = ui.editor.graph;
//     let parent = graph.getDefaultParent();

//     // 1. Criar um gráfico invisível na memória para processar o CSV
//     let tempGraph = new mxGraph();
//     let tempEditor = new EditorUi(new Editor(false, tempGraph));

//     // 2. Usar o motor do draw.io no gráfico temporário (ele vai ler o CSV e criar as setas lá)
//     tempEditor.importCsv(csvData, function (cells) {

//         let model = graph.getModel();
//         model.beginUpdate();
//         try {
//             // 3. Remover as setas antigas do seu gráfico original
//             graph.removeCells(graph.getChildEdges(parent));

//             // 4. Mapear os blocos do gráfico original por ID
//             let destVertices = graph.getChildVertices(parent);
//             let idMap = {};
//             destVertices.forEach(v => {
//                 let id = v.getAttribute('id') || v.id;
//                 idMap[id] = v;
//             });

//             // 5. Pegar as setas criadas no gráfico temporário e "mover" para o original
//             let tempEdges = tempGraph.getChildEdges(tempGraph.getDefaultParent());

//             tempEdges.forEach(edge => {
//                 let sourceId = edge.getTerminal(true).getAttribute('id') || edge.getTerminal(true).id;
//                 let targetId = edge.getTerminal(false).getAttribute('id') || edge.getTerminal(false).id;

//                 // Se ambos os blocos existem no seu desenho original, cria a conexão
//                 if (idMap[sourceId] && idMap[targetId]) {
//                     graph.insertEdge(parent, null, edge.value, idMap[sourceId], idMap[targetId], edge.style);
//                 }
//             });

//         } finally {
//             model.endUpdate();
//             // Limpar o editor temporário da memória
//         }

//     });
//     tempEditor.destroy();
//     graph.refresh();
// }

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


            let layout = new mxHierarchicalLayout(ui.editor.graph, mxConstants.DIRECTION_NORTH);
            layout.intraCellSpacing = 40; // Espaço entre blocos na mesma camada
            layout.interRankCellSpacing = 60; // Espaço entre camadas diferentes
            layout.interHierarchySpacing = 40; // Espaço entre sub-árvores isoladas
            /** let layout = new mxFastOrganicLayout(ui.editor.graph);
            layout.forceConstant = 120; // Distância ideal entre os nós */
            layout.execute(ui.editor.graph.getDefaultParent(), null, cells);
            // Callback executed after shapes are created
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
            let sourceIds = row[fromIdx] ? row[fromIdx].toString().replaceAll('"', '').split(',').map(id => id.trim()) : [];
            for (const srcId of sourceIds) {
                let sourceCell = cellMap[srcId];
                let targetCell = cellMap[row[toIdx]];

                if (!sourceCell || !targetCell) return; // Proteção contra linhas vazias

                if (isInverted) {
                    sourceCell = cellMap[row[toIdx]];
                    targetCell = cellMap[srcId];
                }


                let csvTech = "...";
                let csvType = "Relationship";
                let csvDesc = config.from;

                if (sourceCell && targetCell) {
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
                                if (currentTech === csvTech && currentType === csvType && currentDesc === csvDesc) {
                                    connectionExists = true;
                                    break; // A conexão idêntica já existe, pula a criação
                                }
                            }
                        }
                    }
                    if (!connectionExists) {
                        // Insere a nova conexão com estilo padrão
                        // graph.insertEdge(graph.getDefaultParent(), null, '', sourceCell, targetCell);
                        let doc = mxUtils.createXmlDocument();
                        let cellObject = doc.createElement('UserObject');

                        // Injeta os metadados requeridos pela especificação C4 do draw.io
                        cellObject.setAttribute('placeholders', '1');
                        cellObject.setAttribute('label', config.label);
                        cellObject.setAttribute('c4Technology', csvTech);
                        cellObject.setAttribute('c4Type', csvType);
                        cellObject.setAttribute('c4Description', csvDesc);

                        // Insere a nova conexão encapsulando o objeto de dados C4
                        let newEdge = graph.insertEdge(graph.getDefaultParent(), null, cellObject, sourceCell, targetCell, config.style);

                        // Garante que o draw.io processe a geometria do texto de forma correta
                        newEdge.geometry.relative = true;
                    }
                }
            }
        });
    } finally {
        graph.getModel().endUpdate();
    }

    graph.refresh();
}
