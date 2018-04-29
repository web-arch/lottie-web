function PIXIRenderer(animationItem, config){
    this.animationItem = animationItem;
    this.layers = null;
    this.renderedFrame = -1;
    this.globalData = {
        frameNum: -1
    };
    this.renderConfig = {
        preserveAspectRatio: (config && config.preserveAspectRatio) || 'xMidYMid meet',
        progressiveLoad: (config && config.progressiveLoad) || false
    };
    this.elements = [];
    this.pendingElements = [];
    this.destroyed = false;

}

extendPrototype([BaseRenderer],PIXIRenderer);

PIXIRenderer.prototype.createBase = function (data) {
    return new PIXIBaseElement(data,this.globalData,this);
};

PIXIRenderer.prototype.createShape = function (data) {
    return new PIXIShapeElement(data,this.globalData,this);
};

PIXIRenderer.prototype.createText = function (data) {
    return new SVGTextElement(data,this.globalData,this);

};

PIXIRenderer.prototype.createImage = function (data) {
    return new PIXIImageElement(data,this.globalData,this);
};

PIXIRenderer.prototype.createComp = function (data) {
    return new PIXICompElement(data,this.globalData,this);
};

PIXIRenderer.prototype.createSolid = function (data) {
    return new PIXISolidElement(data,this.globalData,this);
};

PIXIRenderer.prototype.createNull = SVGRenderer.prototype.createNull;

PIXIRenderer.prototype.configAnimation = function(animData){
    animData.width = animData.width/blitter;
    animData.height = animData.height/blitter;
    animData.w = animData.w/blitter;
    animData.h = animData.h/blitter;

    this.layerElement = document.createElementNS(svgNS,'svg');
    this.layerElement.setAttribute('xmlns','http://www.w3.org/2000/svg');
    this.layerElement.setAttribute('width',animData.w);
    this.layerElement.setAttribute('height',animData.h);
    this.layerElement.setAttribute('viewBox','0 0 '+animData.w+' '+animData.h);
    this.layerElement.setAttribute('preserveAspectRatio',this.renderConfig.preserveAspectRatio);
    this.layerElement.style.width = '100%';
    this.layerElement.style.height = '100%';
    this.layerElement.style.transform = 'translate3d(0,0,0)';
    this.layerElement.style.transformOrigin = this.layerElement.style.mozTransformOrigin = this.layerElement.style.webkitTransformOrigin = this.layerElement.style['-webkit-transform'] = "0px 0px 0px";
    //this.animationItem.wrapper.appendChild(this.layerElement);
    ///
    this.renderer = new PIXI.WebGLRenderer(animData.w, animData.h,{antialias:true,transparent:true});
    this.renderer.view.style.transform = 'scale(0.5,0.5)';
    this.renderer.view.style.transformOrigin = '0 0';
    this.animationItem.wrapper.appendChild(this.renderer.view);
    this.stage = new PIXI.Container();
    this.layerElement = this.stage;

    ///
    //Mask animation
    var defs = document.createElementNS(svgNS, 'defs');
    this.globalData.defs = defs;
    this.globalData.getAssetData = this.animationItem.getAssetData.bind(this.animationItem);
    this.globalData.getAssetsPath = this.animationItem.getAssetsPath.bind(this.animationItem);
    this.globalData.renderConfig = this.renderConfig;
    this.globalData.frameId = 0;
    this.globalData.compSize = {
        w: animData.w,
        h: animData.h
    };
    this.data = animData;
    this.globalData.frameRate = animData.fr;

    //Todo mask main container and remove this block of code
    /*var maskElement = document.createElementNS(svgNS, 'clipPath');
    var rect = document.createElementNS(svgNS,'rect');
    rect.setAttribute('width',animData.w);
    rect.setAttribute('height',animData.h);
    rect.setAttribute('x',0);
    rect.setAttribute('y',0);
    var maskId = 'animationMask_'+randomString(10);
    maskElement.setAttribute('id', maskId);
    maskElement.appendChild(rect);
    var maskedElement = document.createElementNS(svgNS,'g');
    maskedElement.setAttribute("clip-path", "url(#"+maskId+")");
    this.layerElement.appendChild(maskedElement);
    defs.appendChild(maskElement);
    this.layerElement = maskedElement;*/

    this.layers = animData.layers;
    this.globalData.fontManager = new FontManager();
    this.globalData.fontManager.addChars(animData.chars);
    this.globalData.fontManager.addFonts(animData.fonts,defs);
    this.elements = Array.apply(null,{length:animData.layers.length});
};

PIXIRenderer.prototype.destroy = function () {
    this.animationItem.wrapper.innerHTML = '';
    this.layerElement = null;
    this.globalData.defs = null;
    var i, len = this.layers ? this.layers.length : 0;
    for (i = 0; i < len; i++) {
        if(this.elements[i]){
            this.elements[i].destroy();
        }
    }
    this.elements.length = 0;
    this.destroyed = true;
    this.animationItem = null;
};

PIXIRenderer.prototype.updateContainerSize = function () {
};

PIXIRenderer.prototype.buildItem  = function(pos){
    var elements = this.elements;
    if(elements[pos] || this.layers[pos].ty == 99){
        return;
    }
    var element = this.createItem(this.layers[pos]);

    elements[pos] = element;
    if(expressionsPlugin){
        if(this.layers[pos].ty === 0){
            this.globalData.projectInterface.registerComposition(element);
        }
        element.initExpressions();
    }
    this.appendElementInPos(element,pos);
    if(this.layers[pos].tt){
        this.buildItem(pos - 1);
        element.setMatte(elements[pos - 1].layerId);
    }
};

PIXIRenderer.prototype.checkPendingElements  = function(){
    while(this.pendingElements.length){
        var element = this.pendingElements.pop();
        element.checkParenting();
    }
};

PIXIRenderer.prototype.renderFrame = function(num){
    if(this.renderedFrame == num || this.destroyed){
        return;
    }
    if(num === null){
        num = this.renderedFrame;
    }else{
        this.renderedFrame = num;
    }
    //clearPoints();
    /*console.log('-------');
    console.log('FRAME ',num);*/
    this.globalData.frameNum = num;
    this.globalData.frameId += 1;
    this.globalData.projectInterface.currentFrame = num;
    var i, len = this.layers.length;
    if(!this.completeLayers){
        this.checkLayers(num);
    }
    for (i = len - 1; i >= 0; i--) {
        if(this.completeLayers || this.elements[i]){
            this.elements[i].prepareFrame(num - this.layers[i].st);
        }
    }
    for (i = len - 1; i >= 0; i--) {
        if(this.completeLayers || this.elements[i]){
            this.elements[i].renderFrame();
        }
    }
    this.renderer.render(this.stage);
};

PIXIRenderer.prototype.appendElementInPos = function(element, pos){
    var newElement = element.getBaseElement();
    if(!newElement){
        return;
    }
    var i = 0;
    var nextElement;
    while(i<pos){
        if(this.elements[i] && this.elements[i].getBaseElement()){
            nextElement = this.elements[i].getBaseElement();
        }
        i += 1;
    }
    if(nextElement){
        var index = this.layerElement.getChildIndex(nextElement);
        this.layerElement.addChildAt(newElement,index);
    } else {
        this.layerElement.addChild(newElement);
    }
};

PIXIRenderer.prototype.hide = function(){
    this.layerElement.style.display = 'none';
};

PIXIRenderer.prototype.show = function(){
    this.layerElement.style.display = 'block';
};

PIXIRenderer.prototype.searchExtraCompositions = function(assets){
    var i, len = assets.length;
    var floatingContainer = document.createElementNS(svgNS,'g');
    for(i=0;i<len;i+=1){
        if(assets[i].xt){
            var comp = this.createComp(assets[i],floatingContainer,this.globalData.comp,null);
            comp.initExpressions();
            //comp.compInterface = CompExpressionInterface(comp);
            //Expressions.addLayersInterface(comp.elements, this.globalData.projectInterface);
            this.globalData.projectInterface.registerComposition(comp);
        }
    }
};