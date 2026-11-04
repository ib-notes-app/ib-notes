// SPDX-License-Identifier: MPL-2.0
import {Component,type ReactNode} from 'react';
import {AppBuildLabel,SupportReport} from './SupportReport';

/** A failed render must leave a readable recovery path, never reset storage. */
type RecoveryProps = {children:ReactNode;onReload?:()=>void;embedded?:boolean;resetKey?:string;
  onReviewEntries?:()=>void;onOpenSettings?:()=>void;timeZone?:string};
export class AppErrorBoundary extends Component<RecoveryProps,{error:Error|null}> {
  state:{error:Error|null}={error:null};
  static getDerivedStateFromError(error:unknown){
    return {error:error instanceof Error?error:new Error(String(error))};
  }
  componentDidUpdate(previous:RecoveryProps){
    if(this.state.error&&previous.resetKey!==this.props.resetKey)this.setState({error:null});
  }
  render(){
    const error=this.state.error;
    if(!error)return this.props.children;
    const recovery=<section className="entry-card app-recovery" role="alert" aria-labelledby="app-recovery-title">
        <h2 id="app-recovery-title">{this.props.embedded?'This screen couldn’t display':'Your journal couldn’t display'}</h2>
        <p>{this.props.embedded?'Your saved journal is still here. Review your entries, open Settings, or use the navigation to continue.':'A screen stopped while opening. Reload to try again; this keeps your saved journal.'}</p>
        {this.props.onReviewEntries&&<button type="button" className="secondary-action" onClick={this.props.onReviewEntries}>Review saved entries</button>}
        {this.props.onOpenSettings&&<button type="button" onClick={this.props.onOpenSettings}>Open Settings</button>}
        <button type="button" className="secondary-action" onClick={()=>this.props.embedded?this.setState({error:null}):this.props.onReload?this.props.onReload():window.location.reload()}>{this.props.embedded?'Retry screen':'Reload app'}</button>
        <AppBuildLabel />
        <SupportReport screen={this.props.embedded?'Screen recovery':'Journal recovery'} timeZone={this.props.timeZone} />
        <details><summary>Error details</summary><pre>{error.stack?.includes(error.message)
          ? error.stack : `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`}</pre></details>
      </section>;
    if(this.props.embedded)return recovery;
    return <main className="app-shell">
      <header className="topbar"><h1><span className="brand-ib">IB</span> Notes</h1></header>
      {recovery}
    </main>;
  }
}
