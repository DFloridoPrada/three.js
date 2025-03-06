import * as THREE from 'three';

class Cube {

    #geometry : THREE.BoxGeometry;
    #material : THREE.MeshNormalMaterial;
    #Mesh : THREE.Mesh;

    constructor() {
        this.#geometry = new THREE.BoxGeometry( 1, 1, 1 );
        this.#material = new THREE.MeshNormalMaterial({
            wireframe: true
        });
        this.#Mesh = new THREE.Mesh( this.#geometry, this.#material );
    }

    getMesh() {
        return this.#Mesh;
    }

    animate() {
        this.#Mesh.rotation.x += 0.01;
        this.#Mesh.rotation.y += 0.01;
    }
}

export default Cube;