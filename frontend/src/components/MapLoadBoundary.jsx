import { Component } from "react";

export class MapLoadBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="map-canvas map-canvas-loading">
          <button type="button" className="button-secondary" onClick={() => this.setState({ failed: false })}>
            Reintentar mapa
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
