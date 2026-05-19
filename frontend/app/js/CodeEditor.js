/* 
    MÓDULO DE EDITOR DE CÓDIGO (CodeMirror)
    Responsável por inicializar e gerenciar o editor de JavaScript.
*/

window.CodeEditor = {
    editor: null,

    init: function(elementId) {
        const textArea = document.getElementById(elementId);
        if (!textArea || typeof CodeMirror === 'undefined') return;

        // Se já existe um editor, não inicializa outro
        if (this.editor) {
            console.warn("CodeEditor já inicializado.");
            return;
        }

        this.editor = CodeMirror.fromTextArea(textArea, {
            mode: "javascript",
            theme: "dracula",
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true
        });

        // Ajusta o tamanho inicial
        this.editor.setSize("100%", "100%");
    },

    getValue: function() {
        return this.editor ? this.editor.getValue() : "";
    },

    setValue: function(value) {
        if (this.editor) {
            this.editor.setValue(value);
        }
    }
};
