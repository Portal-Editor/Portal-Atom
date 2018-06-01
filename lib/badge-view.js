'use babel';
/** @jsx etch.dom */
const etch = require('etch')

export default class BadgeView {
    constructor(user) {
        this.user = user
        etch.initialize(this)
    }

    render() {
        const {id, name, color} = this.user
        let title = name || id
        const fragments = title.split(' ')
        if (fragments.length > 1) {
            shortcut = (fragments[0][0] + fragments[1][0]).toUpperCase()
        } else {
            shortcut = title.slice(0, 2).toUpperCase()
        }
        return (
            <span class='portal-user-badge br-pill pa1 mh1 shadow-1' title={title} style={`background: ${color}`} >
                {shortcut}
            </span>
        )
    }

    update(props) {
        etch.update(this)
    }
}