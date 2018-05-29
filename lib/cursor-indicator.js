'use babel';
/** @jsx etch.dom */
const etch = require('etch')
const $ = etch.dom

export default class CursorIndicator {
    constructor(user) {
        this.user = user
        etch.initialize(this)
    }

    render() {
        return (
        <div class='portal-inline-indicator relative'
             style={`border-left: 2px solid ${this.user.color}; color: ${this.user.color}`}>
            <div class='username-tooltip shadow-1 br2 ph2 pv1'>
                <div class='tooltip-arrow'/>
                {this.user.name || this.user.id}
            </div>
        </div>
    )}

    update(newPros) {
        if (newPorps.user) this.user = newPros.user
        return etch.update(this)
    }
}