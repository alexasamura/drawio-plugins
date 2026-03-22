Draw.loadPlugin(function (ui) {

    let toolbar = ui.toolbar.container;

    let btn = document.createElement('button');
    btn.innerHTML = 'OrgChart Layout';
    btn.className = 'geBtn';
    btn.style.margin = '0 5px';

    let input = document.createElement('input');
    input.setAttribute('type', 'number');
    input.setAttribute('value', '50');
    input.style.width = '50px';
    input.style.margin = '0 5px';
    input.title = 'Parent Spacing';

    function newWindow() {

        let div = document.createElement('div');
        div.style.textAlign = 'center';
        div.style.padding = '20px';

        // Texto e Spinner (usando CSS simples para animação)
        div.innerHTML = '<div class="geStatusAlert" style="cursor:default;padding:10px;">' +
            '<img src="images/spin.gif" style="vertical-align:middle;margin-right:10px;"/>' +
            '<span id="progresso-txt">Running...</span></div><br/>';
        let wnd = new mxWindow('OrgChart Layout', div, 300, 200, 220, 120, false, true);
        wnd.setClosable(false);
        wnd.setVisible(true);
        let x = Math.max(0, (document.body.scrollWidth - wnd.table.clientWidth) / 2);
        let y = Math.max(0, (document.documentElement.clientHeight - wnd.table.clientHeight) * 0.4);
        wnd.setLocation(x, y);
        // wnd.center();
        return wnd;
    }

    ui.actions.addAction('myOrgChartLayout', function () {

        let graph = ui.editor.graph;
        let model = graph.getModel();
        let layout = new mxOrgChartLayout(graph);
        let valor = input.value;
        layout.parentChildSpacing = valor || 100;
        layout.siblingSpacing = 25;
        layout.resizeParent = true;
        layout.useBoundingBox = false;  //Evita buscar IDs de geometria complexa
        layout.edgeRouting = false;     //Ignora os pontos fixos (como seu ID -3)
        layout.ignoreEdges = true;      //Pula a validação de conexões que quebram o layout
        layout.resetEdges = true;
        RPOrgChart.generateData = function () {
            let dataSource = new OrgChart.Test.TestDataSource();

            let graph = RPOrgChart.graph;
            let cells = graph.getChildVertices(RPOrgChart.parent);
            let model = graph.getModel();

            for (const element of cells) {
                let cell = element;

                if (cell.geometry != null && cell.vertex && cell.parent == RPOrgChart.parent) {
                    let parentId = null;

                    let incomingEdge = graph.getIncomingEdges(cell)[0];

                    if (incomingEdge != null && incomingEdge.source != null) {
                        if (model.getParent(incomingEdge.source) == cell.parent) {
                            parentId = incomingEdge.source.id;
                        }
                    }

                    let item = new OrgChart.Test.TestDataItem();
                    item.Id = cell.id;
                    item.ParentId = parentId;
                    dataSource.Items.add(item.getId(), item);
                }
            }

            return dataSource;
        }

        let traverse = function (cell) {

            let childCount = model.getChildCount(cell);
            if (childCount > 0) {
                let hasChildren = false;
                let child = null;
                for (let i = 0; i < childCount; i++) {
                    child = model.getChildAt(cell, i);
                    if (!model.isEdge(child)) {
                        hasChildren = true;
                        traverse(child);
                    }
                }

                let style = cell.getStyle();
                let isContainerAttr = style != null && (style.indexOf('container=1') !== -1 || style.indexOf('swimlane') !== -1);
                console.log('cell: ', cell);
                console.log('isContainerAttr: ', isContainerAttr);
                console.log('hasChildren: ', hasChildren);
                if (isContainerAttr && hasChildren) {
                    try {
                        graph.view.clear();
                        graph.view.validate();
                        layout.execute(cell);
                        graph.updateGroupBounds([cell], 50/*border*/, false /*moveGroup*/, true /*topFill*/);
                    } catch (error) {
                        console.log('layout error: ', error.message);
                    }
                }
            }

        };

        let cells = graph.getSelectionCells();
        if (cells.length > 0) {
            for (const element of cells) {
                let wd = newWindow();
                model.beginUpdate();
                try {
                    traverse(element);
                } catch (e) {
                    console.log('traverse error: ', e.message);
                } finally {
                    wd.destroy();
                    model.endUpdate();
                }
            }
        } else {
            let wd = newWindow();
            model.beginUpdate();
            try {
                traverse(graph.getDefaultParent());
            } catch (e) {
                console.log('traverse error: ', e.message);
            } finally {
                model.endUpdate();
            }

            model.beginUpdate();
            try {
                layout.execute(graph.getDefaultParent());
            } catch (e) {
                console.log('layout DefaultParent error: ', e.message);
            } finally {
                wd.destroy();
                model.endUpdate();
                graph.refresh();
            }
        }
    });



    btn.onclick = function () {
        ui.actions.get('myOrgChartLayout').funct();
    }

    toolbar.appendChild(btn);
    toolbar.appendChild(input);
});