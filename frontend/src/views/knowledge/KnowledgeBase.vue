<template>
  <div class="c-app flex-row align-items-stretch overflow-hidden" style="height: calc(100vh - 120px);">
    <!-- Sidebar: Collections -->
    <CCard class="w-25 h-100 mr-2 d-flex flex-column border-right">
      <CCardHeader class="d-flex justify-content-between align-items-center">
        <strong>Collections</strong>
        <CButton color="success" size="sm" @click="showCreateCollectionModal = true">
          <CIcon name="cil-plus" size="sm"/> New
        </CButton>
      </CCardHeader>
      <div class="flex-grow-1 overflow-auto p-2">
        <div 
          v-for="collection in collections" 
          :key="collection.id"
          class="p-2 mb-1 rounded cursor-pointer d-flex justify-content-between align-items-center"
          :class="{'bg-light': !currentCollection || currentCollection.name !== collection.name, 'bg-primary text-white': currentCollection && currentCollection.name === collection.name}"
          @click="selectCollection(collection)"
          style="cursor: pointer;"
        >
          <span class="text-truncate">{{ collection.name }}</span>
          <CButton 
            v-if="currentCollection && currentCollection.name === collection.name"
            size="sm" 
            color="danger" 
            variant="ghost" 
            class="text-white p-0"
            @click.stop="deleteCollection(collection)"
          >
            <CIcon name="cil-trash" size="sm"/>
          </CButton>
        </div>
      </div>
    </CCard>

    <!-- Main: Documents -->
    <CCard class="flex-grow-1 h-100 d-flex flex-column">
      <CCardHeader class="d-flex justify-content-between align-items-center">
        <strong>{{ currentCollection ? currentCollection.name : 'Select a Collection' }}</strong>
        <div v-if="currentCollection">
           <CButton color="info" size="sm" class="mr-2" @click="showUrlModal = true">
            <CIcon name="cil-link" size="sm"/> Add URL
          </CButton>
          <CButton color="primary" size="sm" @click="triggerFileUpload">
            <CIcon name="cil-cloud-upload" size="sm"/> Upload File
          </CButton>
          <input type="file" ref="fileInput" class="d-none" @change="handleFileUpload" accept=".pdf,.txt,.doc,.docx" />
        </div>
      </CCardHeader>
      
      <div class="flex-grow-1 overflow-auto p-3">
        <div v-if="!currentCollection" class="text-center text-muted mt-5">
          <h4>Select a collection to view documents</h4>
        </div>
        <div v-else-if="documents.length === 0" class="text-center text-muted mt-5">
          <p>No documents in this collection yet.</p>
        </div>
        
        <CTable v-else hover striped border small responsive>
          <template #default>
            <thead>
              <tr>
                <th>Filename/URL</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in documents" :key="doc.filename">
                <td>{{ doc.filename }}</td>
                <td>{{ doc.uploadedBy }}</td>
                <td>{{ new Date(doc.timestamp).toLocaleString() }}</td>
                <td>
                  <CButton color="danger" size="sm" @click="deleteDocument(doc)">Delete</CButton>
                </td>
              </tr>
            </tbody>
          </template>
        </CTable>
      </div>
    </CCard>

    <!-- Create Collection Modal -->
    <CModal
      title="Create New Collection"
      :show.sync="showCreateCollectionModal"
    >
      <CInput
        label="Collection Name"
        v-model="newCollectionName"
        placeholder="e.g. Finance, HR_Policies"
      />
      <template #footer>
        <CButton @click="showCreateCollectionModal = false" color="secondary">Cancel</CButton>
        <CButton @click="createCollection" color="primary" :disabled="!newCollectionName">Create</CButton>
      </template>
    </CModal>

    <!-- Add URL Modal -->
    <CModal
      title="Add URL to Knowledge Base"
      :show.sync="showUrlModal"
    >
      <CInput
        label="URL"
        v-model="newUrl"
        placeholder="https://example.com/article"
      />
      <template #footer>
        <CButton @click="showUrlModal = false" color="secondary">Cancel</CButton>
        <CButton @click="addUrl" color="primary" :disabled="!newUrl">Add</CButton>
      </template>
    </CModal>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="d-flex justify-content-center align-items-center position-absolute w-100 h-100" style="background: rgba(255,255,255,0.7); z-index: 1000; top: 0; left: 0;">
      <CSpinner color="primary" style="width: 3rem; height: 3rem;" />
    </div>

  </div>
</template>

<script>
import Service from '@/service/api'

export default {
  name: 'KnowledgeBase',
  data() {
    return {
      collections: [],
      currentCollection: null,
      documents: [],
      showCreateCollectionModal: false,
      showUrlModal: false,
      newCollectionName: '',
      newUrl: '',
      isLoading: false
    }
  },
  mounted() {
    this.fetchCollections();
  },
  methods: {
    async fetchCollections() {
      try {
        const response = await Service.training('get-collections');
        this.collections = response.data;
      } catch (error) {
        console.error('Error fetching collections:', error);
      }
    },
    async selectCollection(collection) {
      this.currentCollection = collection;
      this.isLoading = true;
      try {
        const response = await Service.training('get-documents', { collectionName: collection.name });
        this.documents = response.data;
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        this.isLoading = false;
      }
    },
    async createCollection() {
      if (!this.newCollectionName) return;
      this.isLoading = true;
      try {
        await Service.training('create-collection', { 
            name: this.newCollectionName,
            permission: 'public' // Default to public for now
        });
        await this.fetchCollections();
        this.showCreateCollectionModal = false;
        this.newCollectionName = '';
      } catch (error) {
        alert('Failed to create collection: ' + (error.response && error.response.data && error.response.data.message || error.message));
      } finally {
        this.isLoading = false;
      }
    },
    async deleteCollection(collection) {
      if (!confirm(`Are you sure you want to delete collection "${collection.name}"? This cannot be undone.`)) return;
      this.isLoading = true;
      try {
        await Service.training('delete-collection', { id: collection.id });
        if (this.currentCollection && this.currentCollection.id === collection.id) {
            this.currentCollection = null;
            this.documents = [];
        }
        await this.fetchCollections();
      } catch (error) {
        alert('Failed to delete collection: ' + (error.response && error.response.data && error.response.data.message || error.message));
      } finally {
        this.isLoading = false;
      }
    },
    triggerFileUpload() {
      this.$refs.fileInput.click();
    },
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      this.isLoading = true;
      try {
        await Service.training('upload-file', {
          file: file,
          collectionName: this.currentCollection.name
        });
        // Refresh documents
        this.selectCollection(this.currentCollection);
        alert('File uploaded successfully');
      } catch (error) {
        alert('Upload failed: ' + (error.response && error.response.data && error.response.data.message || error.message));
      } finally {
        this.isLoading = false;
        // Reset input
        event.target.value = '';
      }
    },
    async addUrl() {
        if(!this.newUrl) return;
        this.isLoading = true;
        try {
            await Service.training('add-urls', {
                urls: [this.newUrl],
                collectionName: this.currentCollection.name,
                modelId: 'titan-embed-text-v1'
            });
            this.selectCollection(this.currentCollection);
            this.showUrlModal = false;
            this.newUrl = '';
            alert('URL processed successfully');
        } catch (error) {
             alert('Failed to add URL: ' + (error.response && error.response.data && error.response.data.message || error.message));
        } finally {
            this.isLoading = false;
        }
    },
    async deleteDocument(doc) {
        if (!confirm(`Delete document "${doc.filename}"?`)) return;
        this.isLoading = true;
        try {
            // Document ID is inside the ids array (just take the first one if multiple chunks, typically deletion handles by ID)
            // But wait, the backend deleteDocument takes :id. The API returns grouped chunks.
            // We need one of the IDs to delete. The controller deletes specific ID.
            // Let's check controller: deleteDocument(collectionName, id). It deletes a SINGLE chunk ID? 
            // Wait, standard chroma deletion usually deletes by ID. 
            // If we want to delete the whole "File", we usually delete where metadata.filename == X.
            // Controller: `await chromaService.deleteDocument(collectionName, id);`
            // Let's assume hitting one ID might delete just that chunk. 
            // Actually, usually RAG systems track "documents" by metadata. Delete by ID removes that chunk.
            
            // Re-reading controller: `deleteDocument` takes one ID.
            // BUT `deleteAllDocuments` deletes ALL in collection.
            // There is no "delete file" endpoint exposed that deletes all chunks for a file.
            // Oh, I see `deleteDocument` endpoint. Let's try passing the first ID.
            // If the user uploaded a file, it yielded multiple chunks (ids).
            // Deleting one chunk is weird.
            // Let's re-read backend/services/chroma.ts if possible, or just look at controller.
            
            // For now, I will use the first ID in doc.ids[0] and hope the backend handles it or it's just one document per ID?
            // "processFileDocuments" returns array of documents. each is a chunk.
            // So to delete a file, we technically need to delete ALL its chunks.
            // The backend unfortunately doesn't seem to have "deleteFile(filename)" endpoint.
            // It only has deleteDocument(id).
            // It might be tedious to delete 100 chunks one by one.
            
            // Workaround: Loop through IDs and delete them? Or maybe the backend supports list of IDs?
            // Controller: `const { id } = req.params;` -> Single ID.
            
            // I will implement a loop here to be safe, although inefficient.
            
            const promises = doc.ids.map(id => Service.training('delete-document', { 
                id: id, 
                collectionName: this.currentCollection.name 
            }));
            
            await Promise.all(promises);
            this.selectCollection(this.currentCollection);
            
        } catch (error) {
            console.error(error);
             alert('Failed to delete document: ' + (error.response && error.response.data && error.response.data.message || error.message));
        } finally {
            this.isLoading = false;
        }
    }
  }
}
</script>
