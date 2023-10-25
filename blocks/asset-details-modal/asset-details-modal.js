import { decorateIcons } from '../../scripts/lib-franklin.js';
import {
  getAnchorVariable, createTag, removeParamFromWindowURL, addHashParamToWindowURL,
} from '../../scripts/scripts.js';
import { authorizeURL, getAssetMetadata } from '../../scripts/polaris.js';
import { getMetadataValue } from '../../scripts/metadata.js';
// eslint-disable-next-line import/no-cycle
import { closeAssetDetails, disableButtons } from '../asset-details-panel/asset-details-panel.js';
import { fetchMetadataAndCreateHTML } from '../../scripts/metadata-html-builder.js';
import { selectNextAsset, selectPreviousAsset } from '../infinite-results/infinite-results.js';
import { getFileTypeCSSClass } from '../../scripts/filetypes.js';
import { getDetailViewConfig, getDetailViewSettings } from '../../scripts/site-config.js';
import { addAssetToContainer } from '../../scripts/assetPanelCreator.js';
import { getAvailableRenditions } from '../../scripts/renditions.js';
import { addDownloadEventListener } from '../download-modal/download-modal.js';
import { EventNames, emitEvent } from '../../scripts/events.js';

let scale = 1;
let assetId;
let assetName;
let format;
let assetJSON;
let originalAssetURL;

function closeModal(block) {
  document.body.classList.remove('no-scroll');
  const modal = block.querySelector('.modal-container');
  modal.querySelector('#asset-details-next')?.classList.remove('hidden');
  modal.querySelector('#asset-details-previous')?.classList.remove('hidden');
  modal.querySelector('.divider.first')?.classList.remove('hidden');
  modal.querySelector('iframe')?.remove();
  removeParamFromWindowURL('assetId');
  closeAssetDetails();
  modal.close();
}

function updateZoomLevel(block) {
  let asset = block.querySelector('.modal-image img');
  if (!asset) {
    asset = block.querySelector('.modal-image iframe');
  }
  asset.style.transform = `scale(${scale})`;
  const zoomLevel = block.querySelector('.asset-details-page-zoom-level');
  zoomLevel.textContent = `${Math.round(scale * 100)}%`;
}

async function createImagePanel(modal) {
  const imgPanel = modal.querySelector('.modal-image');
  assetName = getMetadataValue('repo:name', assetJSON);
  const assetTitle = getMetadataValue('title', assetJSON);
  format = getMetadataValue('dc:format', assetJSON);
  await addAssetToContainer(assetId, assetName, assetTitle, format, imgPanel);
  updateZoomLevel(modal);
}

async function getMetadataElement() {
  const metadataViewConfig = await getDetailViewConfig();
  const detailViewSettings = await getDetailViewSettings();
  return fetchMetadataAndCreateHTML(metadataViewConfig, assetJSON, detailViewSettings.hideEmptyMetadataProperty, false);
}

async function createMetadataPanel(modal) {
  const metadataElem = await getMetadataElement(assetJSON);
  const modalMetadata = modal.querySelector('.modal-metadata');
  const infoButton = modal.querySelector('#asset-details-page-metadata');
  const downloadButton = modal.querySelector('#asset-details-page-download');
  infoButton.classList.add('open');
  downloadButton.classList.remove('open');
  modalMetadata.classList.add('open');

  modalMetadata.querySelector('.metadata-container')?.remove();
  modalMetadata.querySelector('.rendition-container')?.remove();
  modalMetadata.querySelector('.modal-metadata-heading').textContent = 'Details';
  modalMetadata.appendChild(metadataElem);
}

function createHeaderPanel(modal) {
  // set fileName
  const fileNameDiv = modal.querySelector('.file-name');
  fileNameDiv.textContent = assetName;
  // create fileTypeIcon
  const fileTypeIcon = modal.querySelector('.file-type-icon');
  const iconSpan = document.createElement('span');
  const iconClass = getFileTypeCSSClass(format || 'application/octet-stream');
  iconSpan.classList.add('icon', `icon-${iconClass}`);
  fileTypeIcon.querySelector('span')?.remove();
  fileTypeIcon.appendChild(iconSpan);
  decorateIcons(modal);
  // disable nav buttons if needed
  disableButtons(modal);
}

export async function openModal() {
  scale = 1;
  assetId = getAnchorVariable('assetId');
  if (!assetId) {
    const selectedAsset = document.querySelector('#assets .asset-card.selected');
    assetId = selectedAsset.getAttribute('data-asset-id');
    addHashParamToWindowURL('assetId', assetId);
  }
  if (assetId) {
    if (!document.body.classList.contains('no-scroll')) {
      document.body.classList.add('no-scroll');
    }
    const modal = document.querySelector('.modal-container');
    assetJSON = await getAssetMetadata(assetId);

    await createImagePanel(modal, assetId);

    await createMetadataPanel(modal);

    createHeaderPanel(modal, assetId);
    modal.showModal();
    emitEvent(document.body, EventNames.ASSET_DETAIL, {
      assetId,
      assetName: assetJSON.repositoryMetadata['repo:name'],
    });
  }
}

function addRenditionSwitcherEventListener(container, assetContainer) {
  const textContainers = container.querySelectorAll('.text-container');
  let asset = assetContainer.querySelector('img');
  if (!asset) {
    asset = assetContainer.querySelector('iframe');
  }
  originalAssetURL = asset.src;
  textContainers.forEach((textContainer) => {
    textContainer.addEventListener('click', async function() { // eslint-disable-line
      const header = this.querySelector('.header');
      if (header) {
        return;
      }
      textContainers.forEach((innerTextContainer) => {
        innerTextContainer.parentElement.classList.remove('active');
      });
      const rendition = this.parentElement;
      rendition.classList.add('active');
      if (rendition.querySelector('.file-name')?.textContent === 'Original') {
        asset.src = originalAssetURL;
      } else {
        const checkbox = rendition.querySelector('input');
        const url = checkbox.getAttribute('data-url');
        // if the url is a blob url, then we don't need to authorize it
        if (url.includes('blob')) {
          asset.src = url;
        } else {
          const authURL = await authorizeURL(url);
          asset.src = authURL;
          checkbox.setAttribute('data-url', authURL);
        }
      }
    });
  });
}

export default function decorate(block) {
  block.innerHTML = `
    <dialog class="modal-container">
      <div class="modal-header">
          <div class="modal-header-left">
            <div class="file-type-icon"></div>
            <div class="file-name"></div>
          </div>
          <div class="modal-header-right">
            <button id="asset-details-previous" class="action action-previous-asset" title="Previous" aria-label="Previous">
              <span class="icon icon-previous"></span>
            </button>
            <button id="asset-details-next" class="action action-next-asset" title="Next" aria-label="Next">
              <span class="icon icon-next"></span>
            </button>
            <div class="divider first"></div>
            <button id="asset-details-page-zoom-in" class="action action-zoom-in" title="Zoom In" aria-label="Zoom In">
              <span class="icon icon-zoomIn"></span>
            </button>
            <button id="asset-details-page-zoom-out" class="action action-zoom-out" title="Zoom Out" aria-label="Zoom Out">
              <span class="icon icon-zoomOut"></span>
            </button>
            <div class="asset-details-page-zoom-level">100%</div>
            <div class="divider second"></div>
            <button id="asset-details-close" class="action action-close" aria-label="Close">
              <span class="icon icon-close"></span>
            </button>
          </div>
      </div>
      <div class="modal-body">
        <div class="modal-image"></div>
        <div class="modal-metadata open">
          <div class="modal-metadata-heading">Details</div>
        </div>
        <div class="modal-right-panel">
          <button id="asset-details-page-metadata" class="action action-metadata-asset open" title="Hide or View Toggle" aria-label="Metadata">
            <span class="icon icon-info"></span>
          </button>
          <button id="asset-details-page-download" class="action action-download-asset" title="Download" aria-label="Download">
            <span class="icon icon-download"></span>
          </button>
        </div>
      </div>
    </dialog>`;
  decorateIcons(block);

  block.querySelector('#asset-details-close').addEventListener('click', () => {
    closeModal(block);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && block.querySelector('.modal-container').open) {
      closeModal(block);
    }
  });

  // eslint-disable-next-line func-names
  block.querySelector('#asset-details-page-metadata').addEventListener('click', async function () {
    const self = this;
    const modalMetadata = block.querySelector('.modal-metadata');
    const downloadButton = block.querySelector('#asset-details-page-download');
    if (self.classList.contains('open')) {
      self.classList.remove('open');
      modalMetadata.classList.remove('open');
    } else {
      self.classList.add('open');
      modalMetadata.classList.add('open');
      if (downloadButton.classList.contains('open')) {
        downloadButton.classList.remove('open');
      }
      modalMetadata.querySelector('.metadata-container')?.remove();
      modalMetadata.querySelector('.rendition-container')?.remove();
      modalMetadata.querySelector('.modal-metadata-heading').textContent = 'Details';
      const metadataElem = await getMetadataElement(assetJSON);
      modalMetadata.appendChild(metadataElem);
    }
  });

  async function generateRendtionDownloadHTML(modalMetadata) {
    modalMetadata.querySelector('.metadata-container')?.remove();
    modalMetadata.querySelector('.rendition-container')?.remove();
    modalMetadata.querySelector('.modal-metadata-heading').textContent = 'Download';

    // create select all checkbox
    const renditionContainer = createTag('div', { class: 'rendition-container' });
    const renditionFields = createTag('div', { class: 'rendition-fields' });
    const renditionHeader = createTag('div', { class: 'rendition header' });
    const headerCheckbox = createTag('input', {
      type: 'checkbox', name: 'all', value: 'all', id: 'detail-download-all',
    });
    const labelAll = createTag('label', { class: 'checkmark show-bar', for: 'detail-download-all', tabindex: '0' });
    const headerTextContainer = createTag('div', { class: 'text-container' });
    const headerText = createTag('div', { class: 'header' });
    headerText.textContent = 'Select All';
    headerTextContainer.appendChild(headerText);
    renditionHeader.appendChild(headerCheckbox);
    renditionHeader.appendChild(labelAll);
    renditionHeader.appendChild(headerTextContainer);
    renditionFields.appendChild(renditionHeader);

    // create rendition checkboxes
    const renditions = await getAvailableRenditions(assetId, assetName, format);
    renditions.forEach((rendition, index) => {
      const renditionDiv = createTag('div', { class: 'rendition' });
      const checkbox = createTag('input', {
        type: 'checkbox',
        name: 'rendition',
        value: `${rendition.fileName}`,
        'data-url': `${rendition.url}`,
        id: `${rendition.fileName}`,
        'data-format': `${rendition.format}`,
      });
      const label = createTag('label', { class: 'checkmark', for: `${rendition.fileName}`, tabindex: `${index + 1}` });
      const textContainer = createTag('div', { class: 'text-container' });
      const fileName = createTag('div', { class: 'file-name' });
      fileName.textContent = rendition.name;
      if (fileName.textContent === 'Original') {
        renditionDiv.classList.add('active');
        checkbox.checked = true;
      }
      const fileInfo = createTag('div', { class: 'file-info' });
      const fileFormat = createTag('div', { class: 'file-format' });
      fileFormat.textContent = rendition.format;
      const divider = createTag('div', { class: 'divider' });
      const fileSize = createTag('div', { class: 'file-size' });
      const width = rendition.width ? `${rendition.width}` : 'Auto';
      const height = rendition.height ? `${rendition.height}` : 'Auto';
      fileSize.textContent = `${width} x ${height} px`;
      fileInfo.appendChild(fileFormat);
      fileInfo.appendChild(divider);
      fileInfo.appendChild(fileSize);
      textContainer.appendChild(fileName);
      textContainer.appendChild(fileInfo);
      renditionDiv.appendChild(checkbox);
      renditionDiv.appendChild(label);
      renditionDiv.appendChild(textContainer);
      renditionFields.appendChild(renditionDiv);
    });
    if (renditions.length === 1) {
      labelAll.classList.remove('show-bar');
      headerCheckbox.checked = true;
    }
    renditionContainer.appendChild(renditionFields);

    // create download button
    const actionsContainer = createTag('div', { class: 'actions-container' });
    const downloadButton = createTag('button', { class: 'action download' });
    downloadButton.textContent = 'Download 1 file';
    actionsContainer.appendChild(downloadButton);
    renditionContainer.appendChild(actionsContainer);
    addDownloadEventListener(renditionContainer);
    const assetContainer = block.querySelector('.modal-image');
    addRenditionSwitcherEventListener(renditionContainer, assetContainer);
    modalMetadata.appendChild(renditionContainer);
  }

  block.querySelector('#asset-details-page-download').addEventListener('click', async function () {
    const infoButton = block.querySelector('#asset-details-page-metadata');
    const modalMetadata = block.querySelector('.modal-metadata');
    if (this.classList.contains('open')) {
      this.classList.remove('open');
      modalMetadata.classList.remove('open');
    } else {
      this.classList.add('open');
      modalMetadata.classList.add('open');
      if (infoButton.classList.contains('open')) {
        infoButton.classList.remove('open');
      }
      // generate rendition download HTML
      generateRendtionDownloadHTML(modalMetadata);
    }
  });

  block.querySelector('#asset-details-previous').addEventListener('click', () => {
    selectPreviousAsset();
    openModal();
  });

  block.querySelector('#asset-details-next').addEventListener('click', () => {
    selectNextAsset();
    openModal();
  });

  block.querySelector('#asset-details-page-zoom-in').addEventListener('click', () => {
    scale += 0.1;
    updateZoomLevel(block);
  });

  block.querySelector('#asset-details-page-zoom-out').addEventListener('click', () => {
    if (scale > 0.2) {
      scale -= 0.1;
      updateZoomLevel(block);
    }
  });

  assetId = getAnchorVariable('assetId');
  // open modal if assetId is present in the URL
  if (assetId) {
    block.querySelector('#asset-details-next').classList.add('hidden');
    block.querySelector('#asset-details-previous').classList.add('hidden');
    block.querySelector('.divider.first').classList.add('hidden');
    openModal();
  }
}
